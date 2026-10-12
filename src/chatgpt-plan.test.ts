import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, expect, test } from "bun:test";
import {
  CHATGPT_DYNAMIC_CLIENT_ID,
  CHATGPT_PLAN_RESOURCE,
  CHATGPT_PLAN_SCOPE,
  ChatGptPlanError,
  createChatGptHostId,
  exchangeChatGptCode,
  parseChatGptCallback,
  refreshChatGptTokens,
  revokeChatGptSession,
  startChatGptAuthorization,
  type ChatGptPendingAuthorization,
} from "./chatgpt-plan.js";
import { CHATGPT_ISSUER, resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import type { AuthFetch } from "./types.js";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const KID = "test-key";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const ISSUED = "oaiapp_issued123";
const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;

afterEach(() => resetChatGptSigningKeysForTests());

function idToken(claims: Record<string, unknown>, key: KeyObject = privateKey, kid = KID): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function claimsFor(pending: ChatGptPendingAuthorization, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { iss: CHATGPT_ISSUER, sub: "user-sub", aud: ISSUED, exp: NOW / 1000 + 3600, iat: NOW / 1000, nonce: pending.nonce, email: "dev@example.com", ...overrides };
}

type Recorded = { readonly url: string; readonly form: URLSearchParams };

function fakeOpenAi(tokenBody: (form: URLSearchParams) => { readonly status: number; readonly body: unknown }): { readonly fetch: AuthFetch; readonly calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: AuthFetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
    const form = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ url, form });
    const reply = tokenBody(form);
    return Response.json(reply.body, { status: reply.status });
  };
  return { fetch: fetchImpl, calls };
}

function freshAuthorization(clientId?: string) {
  return startChatGptAuthorization({ agentName: "Orbi", hostId: createChatGptHostId(), port: 1455, now: NOW, ...(clientId ? { clientId } : {}) });
}

function callbackFor(pending: ChatGptPendingAuthorization, params: Record<string, string>): string {
  const url = new URL(pending.redirectUri);
  for (const [key, value] of Object.entries({ state: pending.state, ...params })) url.searchParams.set(key, value);
  return url.toString();
}

test("Given a first sign-in, when the authorization URL is built, then it registers a dynamic client with plan scopes and PKCE", () => {
  const { authorizationUrl, pending } = freshAuthorization();
  const url = new URL(authorizationUrl);

  expect(`${url.origin}${url.pathname}`).toBe("https://auth.openai.com/api/accounts/authorize");
  expect(url.searchParams.get("client_id")).toBe(CHATGPT_DYNAMIC_CLIENT_ID);
  expect(url.searchParams.get("agent_name_hint")).toBe("Orbi");
  expect(url.searchParams.get("ext_agent_host_id")).toBe(pending.hostId);
  expect(url.searchParams.get("scope")?.split(" ")).toContain(CHATGPT_PLAN_SCOPE);
  expect(url.searchParams.get("resource")).toBe(CHATGPT_PLAN_RESOURCE);
  expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:1455/auth/callback");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toBe(pending.state);
  expect(url.searchParams.get("nonce")).toBe(pending.nonce);
});

test("Given a returning registration, when the authorization URL is built, then it reuses the issued client and omits the agent name", () => {
  const { authorizationUrl } = freshAuthorization(ISSUED);
  const url = new URL(authorizationUrl);

  expect(url.searchParams.get("client_id")).toBe(ISSUED);
  expect(url.searchParams.has("agent_name_hint")).toBeFalse();
});

test("Given an invalid host id, when authorization starts, then it is rejected before any URL exists", () => {
  expect(() => startChatGptAuthorization({ agentName: "Orbi", hostId: "laptop-1" })).toThrow(ChatGptPlanError);
});

test("Given a pasted callback with the issued client id, when parsed, then the code and issued client are returned", () => {
  const { pending } = freshAuthorization();

  const result = parseChatGptCallback(callbackFor(pending, { code: "abc", client_id: ISSUED }), pending, NOW);

  expect(result).toEqual({ code: "abc", clientId: ISSUED });
});

test("Given a pasted callback for another attempt, when parsed, then it is rejected as invalid", () => {
  const { pending } = freshAuthorization();
  const other = freshAuthorization().pending;

  expect(() => parseChatGptCallback(callbackFor(other, { code: "abc", client_id: ISSUED }), pending, NOW)).toThrow(expect.objectContaining({ code: "callback_invalid" }));
});

test("Given a declined consent, when the callback is parsed, then access_denied is reported", () => {
  const { pending } = freshAuthorization();

  expect(() => parseChatGptCallback(callbackFor(pending, { error: "access_denied" }), pending, NOW)).toThrow(expect.objectContaining({ code: "access_denied" }));
});

test("Given a new-registration callback without an issued client, when parsed, then registration is treated as incomplete", () => {
  const { pending } = freshAuthorization();

  expect(() => parseChatGptCallback(callbackFor(pending, { code: "abc" }), pending, NOW)).toThrow(expect.objectContaining({ code: "callback_invalid" }));
});

test("Given an expired attempt, when the callback is parsed, then it is rejected", () => {
  const { pending } = freshAuthorization();

  expect(() => parseChatGptCallback(callbackFor(pending, { code: "abc", client_id: ISSUED }), pending, pending.expiresAt)).toThrow(expect.objectContaining({ code: "callback_invalid" }));
});

test("Given a granted plan scope and a valid ID token, when the code is exchanged, then tokens and verified identity are returned", async () => {
  const { pending } = freshAuthorization();
  const openai = fakeOpenAi(() => ({ status: 200, body: { access_token: "at", refresh_token: "rt", id_token: idToken(claimsFor(pending)), expires_in: 3600, scope: PLAN_SCOPES } }));

  const signIn = await exchangeChatGptCode({ code: "abc", clientId: ISSUED, pending, fetch: openai.fetch, now: NOW });

  expect(signIn.identity).toEqual({ subject: "user-sub", email: "dev@example.com" });
  expect(signIn.expiresAt).toBe(NOW + 3_600_000);
  expect(openai.calls[0]?.form.get("client_id")).toBe(ISSUED);
  expect(openai.calls[0]?.form.get("code_verifier")).toBe(pending.codeVerifier);
  expect(openai.calls[0]?.form.get("resource")).toBe(CHATGPT_PLAN_RESOURCE);
  expect(openai.calls[0]?.form.get("redirect_uri")).toBe(pending.redirectUri);
});

test("Given a sign-in without the plan scope, when the code is exchanged, then plan_not_granted is reported", async () => {
  const { pending } = freshAuthorization();
  const openai = fakeOpenAi(() => ({ status: 200, body: { access_token: "at", refresh_token: "rt", id_token: idToken(claimsFor(pending)), expires_in: 3600, scope: "openid profile email offline_access" } }));

  await expect(exchangeChatGptCode({ code: "abc", clientId: ISSUED, pending, fetch: openai.fetch, now: NOW })).rejects.toMatchObject({ code: "plan_not_granted" });
});

test("Given an ID token signed by an unknown key, when the code is exchanged, then the identity is rejected", async () => {
  const { pending } = freshAuthorization();
  const forged = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const openai = fakeOpenAi(() => ({ status: 200, body: { access_token: "at", refresh_token: "rt", id_token: idToken(claimsFor(pending), forged), expires_in: 3600, scope: PLAN_SCOPES } }));

  await expect(exchangeChatGptCode({ code: "abc", clientId: ISSUED, pending, fetch: openai.fetch, now: NOW })).rejects.toMatchObject({ code: "id_token_invalid" });
});

test("Given an ID token for another nonce, when the code is exchanged, then the identity is rejected", async () => {
  const { pending } = freshAuthorization();
  const openai = fakeOpenAi(() => ({ status: 200, body: { access_token: "at", refresh_token: "rt", id_token: idToken(claimsFor(pending, { nonce: "other-nonce-value" })), expires_in: 3600, scope: PLAN_SCOPES } }));

  await expect(exchangeChatGptCode({ code: "abc", clientId: ISSUED, pending, fetch: openai.fetch, now: NOW })).rejects.toMatchObject({ code: "id_token_invalid" });
});

test("Given a rotating refresh token, when tokens refresh, then the issued client and resource are sent and replacements returned", async () => {
  const openai = fakeOpenAi(() => ({ status: 200, body: { access_token: "at2", refresh_token: "rt2", expires_in: 3600, scope: PLAN_SCOPES } }));

  const tokens = await refreshChatGptTokens({ clientId: ISSUED, refreshToken: "rt1", fetch: openai.fetch, now: NOW });

  expect(tokens).toMatchObject({ accessToken: "at2", refreshToken: "rt2", clientId: ISSUED });
  expect(openai.calls[0]?.form.get("grant_type")).toBe("refresh_token");
  expect(openai.calls[0]?.form.get("client_id")).toBe(ISSUED);
  expect(openai.calls[0]?.form.get("resource")).toBe(CHATGPT_PLAN_RESOURCE);
  expect(openai.calls[0]?.form.has("scope")).toBeFalse();
});

test("Given a revoked session, when tokens refresh, then reconnect_required is reported", async () => {
  const openai = fakeOpenAi(() => ({ status: 400, body: { error: "invalid_grant" } }));

  await expect(refreshChatGptTokens({ clientId: ISSUED, refreshToken: "rt1", fetch: openai.fetch, now: NOW })).rejects.toMatchObject({ code: "reconnect_required" });
});

test("Given a ChatGPT outage, when tokens refresh, then the failure is retryable and credentials are kept", async () => {
  const openai = fakeOpenAi(() => ({ status: 503, body: {} }));

  await expect(refreshChatGptTokens({ clientId: ISSUED, refreshToken: "rt1", fetch: openai.fetch, now: NOW })).rejects.toMatchObject({ code: "upstream_unavailable" });
});

test("Given a sign-out, when the session is revoked, then the refresh token is posted to the revocation endpoint", async () => {
  const openai = fakeOpenAi(() => ({ status: 200, body: {} }));

  const confirmed = await revokeChatGptSession({ clientId: ISSUED, refreshToken: "rt1", fetch: openai.fetch });

  expect(confirmed).toBeTrue();
  expect(openai.calls[0]?.url).toBe("https://auth.openai.com/api/accounts/oauth/revoke");
  expect(openai.calls[0]?.form.get("token_type_hint")).toBe("refresh_token");
});
