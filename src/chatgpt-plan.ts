import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { CHATGPT_ISSUER, ChatGptPlanError, type ChatGptIdentity, verifyChatGptIdToken } from "./chatgpt-plan-id-token.js";
import type { AuthFetch } from "./types.js";

export { CHATGPT_ISSUER, ChatGptPlanError, type ChatGptIdentity, type ChatGptPlanErrorCode } from "./chatgpt-plan-id-token.js";

export const CHATGPT_AUTHORIZE_URL = `${CHATGPT_ISSUER}/api/accounts/authorize`;
export const CHATGPT_TOKEN_URL = `${CHATGPT_ISSUER}/api/accounts/oauth/token`;
export const CHATGPT_REVOKE_URL = `${CHATGPT_ISSUER}/api/accounts/oauth/revoke`;
export const CHATGPT_PLAN_RESOURCE = "https://api.openai.com/v1";
export const CHATGPT_PLAN_SCOPE = "chatgpt.tokens.use.direct";
export const CHATGPT_PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;
export const CHATGPT_DYNAMIC_CLIENT_ID = "dynamic_agent_client";
export const CHATGPT_CALLBACK_PATH = "/auth/callback";
export const CHATGPT_DEFAULT_CALLBACK_PORT = 1455;

const PENDING_TTL_MS = 10 * 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const HOST_ID = /^(?:urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|urn:ietf:params:oauth:jwk-thumbprint:[A-Za-z0-9._~:%-]+|did:key:z[1-9A-HJ-NP-Za-km-z]+)$/;
const RECONNECT_ERRORS = new Set(["invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"]);

export const ChatGptPendingAuthorizationSchema = z.object({
  state: z.string().min(16),
  nonce: z.string().min(16),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().min(1),
  clientId: z.string().min(1),
  hostId: z.string().regex(HOST_ID),
  expiresAt: z.number().int().positive(),
}).readonly();
export type ChatGptPendingAuthorization = z.output<typeof ChatGptPendingAuthorizationSchema>;

export interface ChatGptAuthorizationRequest {
  readonly agentName: string;
  readonly hostId: string;
  readonly clientId?: string;
  readonly port?: number;
  readonly loginHint?: string;
  readonly now?: number;
}

export interface ChatGptAuthorization {
  readonly authorizationUrl: string;
  readonly pending: ChatGptPendingAuthorization;
}

export interface ChatGptCallbackResult {
  readonly code: string;
  readonly clientId: string;
}

export interface ChatGptPlanTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly scopes: readonly string[];
  readonly clientId: string;
}

export interface ChatGptSignIn extends ChatGptPlanTokens {
  readonly identity: ChatGptIdentity;
}

export interface ChatGptExchangeInput {
  readonly code: string;
  readonly clientId: string;
  readonly pending: ChatGptPendingAuthorization;
  readonly fetch?: AuthFetch;
  readonly now?: number;
}

export interface ChatGptRefreshInput {
  readonly clientId: string;
  readonly refreshToken: string;
  readonly fetch?: AuthFetch;
  readonly now?: number;
}

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  id_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  scope: z.string().default(""),
});
const TokenErrorSchema = z.object({ error: z.string().min(1) });

export function createChatGptHostId(): string {
  return `urn:uuid:${randomUUID()}`;
}

export function isChatGptHostId(value: string): boolean {
  return HOST_ID.test(value);
}

export function chatGptRedirectUri(port: number = CHATGPT_DEFAULT_CALLBACK_PORT): string {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new ChatGptPlanError("callback_invalid", `Invalid callback port: ${port}`);
  return `http://127.0.0.1:${port}${CHATGPT_CALLBACK_PATH}`;
}

function randomText(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function startChatGptAuthorization(request: ChatGptAuthorizationRequest): ChatGptAuthorization {
  if (!isChatGptHostId(request.hostId)) throw new ChatGptPlanError("callback_invalid", "ext_agent_host_id must be a urn:uuid, JWK thumbprint URI, or did:key value");
  const clientId = request.clientId ?? CHATGPT_DYNAMIC_CLIENT_ID;
  const pending = ChatGptPendingAuthorizationSchema.parse({
    state: randomText(32),
    nonce: randomText(32),
    codeVerifier: randomText(48),
    redirectUri: chatGptRedirectUri(request.port),
    clientId,
    hostId: request.hostId,
    expiresAt: (request.now ?? Date.now()) + PENDING_TTL_MS,
  });
  const url = new URL(CHATGPT_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  if (clientId === CHATGPT_DYNAMIC_CLIENT_ID) url.searchParams.set("agent_name_hint", request.agentName);
  url.searchParams.set("ext_agent_host_id", request.hostId);
  if (request.loginHint) url.searchParams.set("login_hint", request.loginHint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", pending.redirectUri);
  url.searchParams.set("scope", CHATGPT_PLAN_SCOPES);
  url.searchParams.set("resource", CHATGPT_PLAN_RESOURCE);
  url.searchParams.set("state", pending.state);
  url.searchParams.set("nonce", pending.nonce);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", createHash("sha256").update(pending.codeVerifier).digest("base64url"));
  return { authorizationUrl: url.toString(), pending };
}

function parseUrl(input: string): URL {
  try {
    return new URL(input.trim());
  } catch (error) {
    if (error instanceof TypeError) throw new ChatGptPlanError("callback_invalid", "Paste the full address from the browser after approving.", { cause: error });
    throw error;
  }
}

export function parseChatGptCallback(input: string, pending: ChatGptPendingAuthorization, now: number = Date.now()): ChatGptCallbackResult {
  if (now >= pending.expiresAt) throw new ChatGptPlanError("callback_invalid", "This sign-in expired. Start again.");
  const url = parseUrl(input);
  const expected = new URL(pending.redirectUri);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname) {
    throw new ChatGptPlanError("callback_invalid", `The address must start with ${pending.redirectUri}`);
  }
  if (url.searchParams.get("state") !== pending.state) throw new ChatGptPlanError("callback_invalid", "This address belongs to a different sign-in attempt.");
  const error = url.searchParams.get("error");
  if (error === "access_denied") throw new ChatGptPlanError("access_denied", "ChatGPT access was declined.");
  if (error) {
    const detail = url.searchParams.get("error_description") ?? error;
    throw new ChatGptPlanError("callback_invalid", "ChatGPT sign-in failed. Start again.", { cause: new Error(detail) });
  }
  const code = url.searchParams.get("code");
  if (!code) throw new ChatGptPlanError("callback_invalid", "The address does not contain an authorization code.");
  const returned = url.searchParams.get("client_id")?.trim();
  if (pending.clientId === CHATGPT_DYNAMIC_CLIENT_ID) {
    if (!returned || returned === CHATGPT_DYNAMIC_CLIENT_ID) throw new ChatGptPlanError("callback_invalid", "ChatGPT did not finish registering this app. Start again.");
    return { code, clientId: returned };
  }
  if (returned && returned !== pending.clientId) throw new ChatGptPlanError("callback_invalid", "The address belongs to a different ChatGPT registration.");
  return { code, clientId: pending.clientId };
}

async function postForm(url: string, form: Readonly<Record<string, string>>, fetchImpl: AuthFetch): Promise<Response> {
  try {
    return await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ChatGptPlanError("upstream_unavailable", "Could not reach ChatGPT sign-in.", { cause: error });
  }
}

async function tokenErrorCode(response: Response): Promise<string | undefined> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = TokenErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error : undefined;
}

async function readTokens(response: Response, refreshing: boolean): Promise<z.output<typeof TokenResponseSchema>> {
  if (response.status >= 500) throw new ChatGptPlanError("upstream_unavailable", `ChatGPT sign-in is unavailable (${response.status}).`);
  if (!response.ok) {
    const code = await tokenErrorCode(response);
    if (code === "invalid_client") throw new ChatGptPlanError("invalid_client", "ChatGPT rejected this app registration. Sign in again.");
    if (refreshing && code !== undefined && RECONNECT_ERRORS.has(code)) throw new ChatGptPlanError("reconnect_required", "The ChatGPT connection ended. Sign in again.");
    if (refreshing) throw new ChatGptPlanError("upstream_unavailable", `ChatGPT token refresh failed (${response.status}).`);
    throw new ChatGptPlanError("callback_invalid", "ChatGPT rejected this sign-in code. Start again.");
  }
  const parsed = TokenResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new ChatGptPlanError("upstream_unavailable", "ChatGPT returned an unexpected token response.");
  return parsed.data;
}

function tokensFrom(body: z.output<typeof TokenResponseSchema>, clientId: string, now: number): ChatGptPlanTokens {
  const scopes = body.scope.split(/\s+/).filter(Boolean);
  if (!scopes.includes(CHATGPT_PLAN_SCOPE)) {
    throw new ChatGptPlanError("plan_not_granted", "ChatGPT plan usage was not allowed. Sign in again and allow plan usage, or use an API key.");
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000, scopes, clientId };
}

export async function exchangeChatGptCode(input: ChatGptExchangeInput): Promise<ChatGptSignIn> {
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const response = await postForm(CHATGPT_TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.pending.codeVerifier,
    redirect_uri: input.pending.redirectUri,
    resource: CHATGPT_PLAN_RESOURCE,
  }, fetchImpl);
  const body = await readTokens(response, false);
  if (body.id_token === undefined) throw new ChatGptPlanError("id_token_invalid", "ChatGPT did not return an ID token.");
  const now = input.now ?? Date.now();
  const identity = await verifyChatGptIdToken(body.id_token, { clientId: input.clientId, nonce: input.pending.nonce, fetch: fetchImpl, now });
  return { ...tokensFrom(body, input.clientId, now), identity };
}

export async function refreshChatGptTokens(input: ChatGptRefreshInput): Promise<ChatGptPlanTokens> {
  const response = await postForm(CHATGPT_TOKEN_URL, {
    grant_type: "refresh_token",
    client_id: input.clientId,
    refresh_token: input.refreshToken,
    resource: CHATGPT_PLAN_RESOURCE,
  }, input.fetch ?? globalThis.fetch);
  return tokensFrom(await readTokens(response, true), input.clientId, input.now ?? Date.now());
}

export async function revokeChatGptSession(input: Omit<ChatGptRefreshInput, "now">): Promise<boolean> {
  const response = await postForm(CHATGPT_REVOKE_URL, {
    token: input.refreshToken,
    token_type_hint: "refresh_token",
    client_id: input.clientId,
  }, input.fetch ?? globalThis.fetch).catch((error: unknown) => {
    if (error instanceof ChatGptPlanError) return undefined;
    throw error;
  });
  return response?.ok ?? false;
}
