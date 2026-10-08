import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import type { AuthFetch } from "./types.js";

export const CHATGPT_ISSUER = "https://auth.openai.com";
export const CHATGPT_JWKS_URL = `${CHATGPT_ISSUER}/.well-known/jwks.json`;

const CLOCK_SKEW_SECONDS = 120;
const JWKS_TTL_MS = 60 * 60_000;
const JWKS_TIMEOUT_MS = 10_000;

export type ChatGptPlanErrorCode =
  | "callback_invalid"
  | "access_denied"
  | "plan_not_granted"
  | "id_token_invalid"
  | "invalid_client"
  | "reconnect_required"
  | "upstream_unavailable";

export class ChatGptPlanError extends Error {
  readonly name = "ChatGptPlanError";
  constructor(readonly code: ChatGptPlanErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export interface ChatGptIdentity {
  readonly subject: string;
  readonly email?: string;
  readonly name?: string;
}

export interface ChatGptIdTokenCheck {
  readonly clientId: string;
  readonly nonce: string;
  readonly fetch: AuthFetch;
  readonly now: number;
}

const HeaderSchema = z.object({ alg: z.literal("RS256"), kid: z.string().min(1) });
const ClaimsSchema = z.object({
  iss: z.literal(CHATGPT_ISSUER),
  sub: z.string().min(1),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  iat: z.number(),
  nonce: z.string().min(1),
  email: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});
const JwkSchema = z.looseObject({ kty: z.literal("RSA"), kid: z.string().min(1), n: z.string().min(1), e: z.string().min(1) });
const JwksSchema = z.object({ keys: z.array(z.unknown()) });

type Jwk = z.output<typeof JwkSchema>;
let cachedKeys: { readonly keys: readonly Jwk[]; readonly fetchedAt: number } | undefined;

function invalid(message: string, cause?: unknown): ChatGptPlanError {
  return new ChatGptPlanError("id_token_invalid", message, cause === undefined ? undefined : { cause });
}

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch (error) {
    throw invalid("ChatGPT returned a malformed ID token.", error);
  }
}

async function loadKeys(fetchImpl: AuthFetch, now: number, force: boolean): Promise<readonly Jwk[]> {
  if (!force && cachedKeys !== undefined && now - cachedKeys.fetchedAt < JWKS_TTL_MS) return cachedKeys.keys;
  let response: Response;
  try {
    response = await fetchImpl(CHATGPT_JWKS_URL, { redirect: "error", signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
  } catch (error) {
    throw new ChatGptPlanError("upstream_unavailable", "Could not load ChatGPT signing keys.", { cause: error });
  }
  if (!response.ok) throw new ChatGptPlanError("upstream_unavailable", `ChatGPT signing keys are unavailable (${response.status}).`);
  const body = JwksSchema.safeParse(await response.json().catch(() => undefined));
  if (!body.success) throw new ChatGptPlanError("upstream_unavailable", "ChatGPT returned malformed signing keys.");
  const keys = body.data.keys.flatMap((key) => {
    const parsed = JwkSchema.safeParse(key);
    return parsed.success ? [parsed.data] : [];
  });
  cachedKeys = { keys, fetchedAt: now };
  return keys;
}

async function signingKey(kid: string, check: ChatGptIdTokenCheck): Promise<Jwk> {
  const cached = (await loadKeys(check.fetch, check.now, false)).find((key) => key.kid === kid);
  if (cached !== undefined) return cached;
  const refreshed = (await loadKeys(check.fetch, check.now, true)).find((key) => key.kid === kid);
  if (refreshed === undefined) throw invalid("ChatGPT signed the ID token with an unknown key.");
  return refreshed;
}

export async function verifyChatGptIdToken(token: string, check: ChatGptIdTokenCheck): Promise<ChatGptIdentity> {
  const [headerPart, payloadPart, signaturePart, ...rest] = token.split(".");
  if (headerPart === undefined || payloadPart === undefined || signaturePart === undefined || rest.length > 0) throw invalid("ChatGPT returned a malformed ID token.");
  const header = HeaderSchema.safeParse(decodeJson(headerPart));
  if (!header.success) throw invalid("ChatGPT ID token uses an unexpected signing algorithm.");
  const jwk = await signingKey(header.data.kid, check);
  const publicKey = createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: "jwk" });
  const signed = verify("RSA-SHA256", Buffer.from(`${headerPart}.${payloadPart}`), publicKey, Buffer.from(signaturePart, "base64url"));
  if (!signed) throw invalid("ChatGPT ID token signature is invalid.");
  const claims = ClaimsSchema.safeParse(decodeJson(payloadPart));
  if (!claims.success) throw invalid("ChatGPT ID token claims are invalid.");
  const audience = Array.isArray(claims.data.aud) ? claims.data.aud : [claims.data.aud];
  if (!audience.includes(check.clientId)) throw invalid("ChatGPT ID token was issued for a different app.");
  if (claims.data.nonce !== check.nonce) throw invalid("ChatGPT ID token belongs to a different sign-in attempt.");
  const nowSeconds = Math.floor(check.now / 1000);
  if (claims.data.exp + CLOCK_SKEW_SECONDS < nowSeconds) throw invalid("ChatGPT ID token has expired.");
  if (claims.data.iat - CLOCK_SKEW_SECONDS > nowSeconds) throw invalid("ChatGPT ID token was issued in the future.");
  return {
    subject: claims.data.sub,
    ...(claims.data.email === undefined ? {} : { email: claims.data.email }),
    ...(claims.data.name === undefined ? {} : { name: claims.data.name }),
  };
}

export function resetChatGptSigningKeysForTests(): void {
  cachedKeys = undefined;
}
