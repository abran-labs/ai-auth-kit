import { generateKeyPairSync, sign } from "node:crypto";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { CHATGPT_ISSUER } from "./chatgpt-plan-id-token.js";
import type { ChatGptPlanLoginDeps } from "./account-oauth-chatgpt.js";
import type { PromptAdapter } from "./picker.js";
import type { AuthFetch } from "./types.js";

export const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
export const ISSUED = "oaiapp_testissued";
export const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;

const KID = "chatgpt-login-test";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });

export interface ChatGptTestCaptured {
  nonce?: string;
  clientId?: string;
  state?: string;
  redirectUri?: string;
  authorizationUrl?: string;
}

export function mintIdToken(nonce: string, clientId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: KID })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: CHATGPT_ISSUER,
    sub: "user-sub",
    aud: clientId,
    exp: NOW / 1000 + 3600,
    iat: NOW / 1000,
    nonce,
    email: "dev@example.com",
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

export function createFakeOpenAi(captured: ChatGptTestCaptured, scopes: string = PLAN_SCOPES, issued: string = ISSUED): {
  readonly fetch: AuthFetch;
  readonly calls: { readonly url: string; readonly form: URLSearchParams }[];
} {
  const calls: { readonly url: string; readonly form: URLSearchParams }[] = [];
  const fetchImpl: AuthFetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/.well-known/jwks.json")) {
      return Response.json({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
    }
    const form = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ url, form });
    if (url.endsWith("/oauth/revoke")) return Response.json({});
    if (form.get("grant_type") === "refresh_token") {
      return Response.json({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600, scope: scopes });
    }
    return Response.json({
      access_token: "access-1",
      refresh_token: "refresh-1",
      id_token: mintIdToken(captured.nonce ?? "", issued),
      expires_in: 3600,
      scope: scopes,
    });
  };
  return { fetch: fetchImpl, calls };
}

export function captureAuthorization(captured: ChatGptTestCaptured): (url: string) => void {
  return (url: string) => {
    const auth = new URL(url);
    captured.authorizationUrl = url;
    captured.nonce = auth.searchParams.get("nonce") ?? undefined;
    captured.clientId = auth.searchParams.get("client_id") ?? undefined;
    captured.state = auth.searchParams.get("state") ?? undefined;
    captured.redirectUri = auth.searchParams.get("redirect_uri") ?? undefined;
  };
}

export function callbackUrl(captured: ChatGptTestCaptured, params: Readonly<Record<string, string>>): string {
  if (captured.redirectUri === undefined || captured.state === undefined) throw new Error("Authorization URL was not captured");
  const url = new URL(captured.redirectUri);
  url.searchParams.set("state", captured.state);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function loopbackBrowser(captured: ChatGptTestCaptured, params: Readonly<Record<string, string>>): (url: string) => Promise<boolean> {
  return async (url: string) => {
    captureAuthorization(captured)(url);
    const response = await globalThis.fetch(callbackUrl(captured, params));
    if (response.status !== 200) throw new Error(`Loopback callback failed: ${response.status}`);
    return true;
  };
}

export function createAdapter(overrides: Partial<PromptAdapter> = {}): PromptAdapter & { readonly infos: string[] } {
  const infos: string[] = [];
  return {
    infos,
    isCancel: (value: unknown): value is symbol => typeof value === "symbol",
    autocomplete: async () => Symbol(),
    select: async () => Symbol(),
    confirm: async () => false,
    password: async () => Symbol(),
    info: (message: string) => { infos.push(message); },
    ...overrides,
  };
}

export function createDeps(captured: ChatGptTestCaptured, fetch: AuthFetch, overrides: Partial<ChatGptPlanLoginDeps> = {}): ChatGptPlanLoginDeps {
  return {
    fetch,
    now: () => NOW,
    chatGptLoopbackPorts: [0],
    chatGptLoopbackTimeoutMs: 5000,
    agentName: "TestHost",
    ...overrides,
  };
}
