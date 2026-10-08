import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { loginChatGptPlan, signOutChatGptPlan, type ChatGptPlanLoginDeps } from "./account-oauth-chatgpt.js";
import { CHATGPT_PLAN_SCOPE, CHATGPT_TOKEN_URL } from "./chatgpt-plan.js";
import { CHATGPT_ISSUER, resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { CHATGPT_HOST_ID_REF } from "./credential-removal.js";
import { createProjectAuthKit, type AuthKit } from "./kit.js";
import type { PromptAdapter } from "./picker.js";
import type { AuthFetch } from "./types.js";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const KID = "chatgpt-login-test";
const ISSUED = "oaiapp_testissued";
const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });

let dir: string;
let kit: AuthKit;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-chatgpt-login-"));
  kit = createProjectAuthKit("test-tool", { rootDir: dir });
});

afterEach(async () => {
  resetChatGptSigningKeysForTests();
  await rm(dir, { recursive: true, force: true });
});

function idToken(nonce: string, clientId: string): string {
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

interface Captured {
  nonce?: string;
  clientId?: string;
  state?: string;
  redirectUri?: string;
  authorizationUrl?: string;
}

function fakeOpenAi(captured: Captured, scopes: string = PLAN_SCOPES, issued: string = ISSUED): { readonly fetch: AuthFetch; readonly calls: { readonly url: string; readonly form: URLSearchParams }[] } {
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
      id_token: idToken(captured.nonce ?? "", issued),
      expires_in: 3600,
      scope: scopes,
    });
  };
  return { fetch: fetchImpl, calls };
}

function captureAuthorization(captured: Captured): (url: string) => void {
  return (url: string) => {
    const auth = new URL(url);
    captured.authorizationUrl = url;
    captured.nonce = auth.searchParams.get("nonce") ?? undefined;
    captured.clientId = auth.searchParams.get("client_id") ?? undefined;
    captured.state = auth.searchParams.get("state") ?? undefined;
    captured.redirectUri = auth.searchParams.get("redirect_uri") ?? undefined;
  };
}

function callbackUrl(captured: Captured, params: Readonly<Record<string, string>>): string {
  if (captured.redirectUri === undefined || captured.state === undefined) throw new Error("Authorization URL was not captured");
  const url = new URL(captured.redirectUri);
  url.searchParams.set("state", captured.state);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function adapterWith(overrides: Partial<PromptAdapter> = {}): PromptAdapter & { readonly infos: string[] } {
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

function depsWith(captured: Captured, openai: { readonly fetch: AuthFetch }, overrides: Partial<ChatGptPlanLoginDeps> = {}): ChatGptPlanLoginDeps {
  return {
    fetch: openai.fetch,
    now: () => NOW,
    chatGptLoopbackPorts: [0],
    chatGptLoopbackTimeoutMs: 5000,
    agentName: "TestHost",
    ...overrides,
  };
}

test("Given a first sign-in, when the browser loopback completes, then tokens are stored under the plan adapter", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  const adapter = adapterWith();
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    const response = await globalThis.fetch(callbackUrl(captured, { code: "auth-code-1", client_id: ISSUED }));
    expect(response.status).toBe(200);
    return true;
  };

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, depsWith(captured, openai, { openUrl }));

  const auth = new URL(captured.authorizationUrl ?? "");
  expect(auth.searchParams.get("client_id")).toBe("dynamic_agent_client");
  expect(auth.searchParams.get("agent_name_hint")).toBe("TestHost");
  expect(auth.searchParams.get("scope")?.split(" ")).toContain(CHATGPT_PLAN_SCOPE);
  expect(captured.redirectUri ?? "").toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
  const hostId = await kit.secrets.get(CHATGPT_HOST_ID_REF);
  expect(hostId).toMatch(/^urn:uuid:/);
  expect(auth.searchParams.get("ext_agent_host_id")).toBe(hostId);
  expect(credential).toEqual(expect.objectContaining({
    type: "oauth-external",
    metadata: expect.objectContaining({ adapter: "openai-chatgpt-plan", clientId: ISSUED, subject: "user-sub", email: "dev@example.com", baseUrl: "https://api.openai.com/v1" }),
  }));
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("access-1");
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("refresh-1");
  expect(await kit.getCredential("openai")).toEqual(credential);
  expect(adapter.infos.join("\n")).toContain("browser");
});

test("Given a headless terminal, when the redirect URL is pasted, then sign-in completes without a browser callback", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  let pasted = "";
  const adapter = adapterWith({
    text: (async () => pasted) as PromptAdapter["text"],
  });
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    pasted = callbackUrl(captured, { code: "auth-code-paste", client_id: ISSUED });
    return false;
  };

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, depsWith(captured, openai, { openUrl }));

  expect(credential).toEqual(expect.objectContaining({
    type: "oauth-external",
    metadata: expect.objectContaining({ adapter: "openai-chatgpt-plan", clientId: ISSUED }),
  }));
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("access-1");
  expect(adapter.infos.join("\n")).toContain("Open this URL");
});

test("Given a declined consent, when the pasted redirect carries access_denied, then sign-in fails and nothing is saved", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  let pasted = "";
  const adapter = adapterWith({
    text: (async () => pasted) as PromptAdapter["text"],
  });
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    pasted = callbackUrl(captured, { error: "access_denied" });
    return false;
  };

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, depsWith(captured, openai, { openUrl }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "access_denied" });

  expect(await kit.getCredential("openai")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(adapter.infos.join("\n")).toContain("declined");
});

test("Given plan usage not granted, when the code is exchanged, then sign-in fails and nothing is saved", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured, "openid profile email offline_access");
  const adapter = adapterWith();
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    const response = await globalThis.fetch(callbackUrl(captured, { code: "auth-code-2", client_id: ISSUED }));
    expect(response.status).toBe(200);
    return true;
  };

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, depsWith(captured, openai, { openUrl }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "plan_not_granted" });

  expect(await kit.getCredential("openai")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(adapter.infos.join("\n")).toContain("allow plan usage");
  expect(adapter.infos.join("\n")).toContain("API key");
});

test("Given an existing plan credential, when signing in again, then the issued client and saved email are reused", async () => {
  await kit.secrets.set("provider:openai:oauth:access-token", "old-access");
  await kit.secrets.set("provider:openai:oauth:refresh-token", "old-refresh");
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_reauth",
    subject: "user-sub",
    email: "reauth@example.com",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(NOW + 3600_000),
    scopes: PLAN_SCOPES,
    baseUrl: "https://api.openai.com/v1",
  });
  const captured: Captured = {};
  const openai = fakeOpenAi(captured, PLAN_SCOPES, "oaiapp_reauth");
  const adapter = adapterWith();
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    const response = await globalThis.fetch(callbackUrl(captured, { code: "auth-code-3", client_id: "oaiapp_reauth" }));
    expect(response.status).toBe(200);
    return true;
  };

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, depsWith(captured, openai, { openUrl }));

  const auth = new URL(captured.authorizationUrl ?? "");
  expect(auth.searchParams.get("client_id")).toBe("oaiapp_reauth");
  expect(auth.searchParams.has("agent_name_hint")).toBeFalse();
  expect(auth.searchParams.get("login_hint")).toBe("reauth@example.com");
  expect(openai.calls.some((call) => call.url === CHATGPT_TOKEN_URL && call.form.get("client_id") === "oaiapp_reauth")).toBeTrue();
  expect(credential).toEqual(expect.objectContaining({
    metadata: expect.objectContaining({ clientId: "oaiapp_reauth" }),
  }));
});

test("Given a completed sign-in, when another kit instance reads state, then the host id persists and survives reconcile", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    await globalThis.fetch(callbackUrl(captured, { code: "auth-code-4", client_id: ISSUED }));
    return true;
  };
  await loginChatGptPlan(kit, kit.getProvider("openai"), adapterWith(), depsWith(captured, openai, { openUrl }));
  const hostId = await kit.secrets.get(CHATGPT_HOST_ID_REF);

  const second = createProjectAuthKit("test-tool", { rootDir: dir });

  expect(await second.secrets.get(CHATGPT_HOST_ID_REF)).toBe(hostId);
  await second.readState();
  expect(await second.secrets.get(CHATGPT_HOST_ID_REF)).toBe(hostId);
});

test("Given a stored plan session, when signing out, then the refresh token is revoked and token secrets are cleared", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    await globalThis.fetch(callbackUrl(captured, { code: "auth-code-5", client_id: ISSUED }));
    return true;
  };
  await loginChatGptPlan(kit, kit.getProvider("openai"), adapterWith(), depsWith(captured, openai, { openUrl }));
  const hostId = await kit.secrets.get(CHATGPT_HOST_ID_REF);

  const result = await signOutChatGptPlan(kit, { fetch: openai.fetch });

  expect(result).toEqual({ remoteRevocationConfirmed: true });
  const revoke = openai.calls.find((call) => call.url.endsWith("/oauth/revoke"));
  expect(revoke?.form.get("token")).toBe("refresh-1");
  expect(revoke?.form.get("client_id")).toBe(ISSUED);
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(await kit.getCredential("openai")).toEqual(expect.objectContaining({
    type: "oauth-external",
    metadata: expect.objectContaining({ adapter: "openai-chatgpt-plan", clientId: ISSUED, health: "reconnect-required" }),
  }));
  expect(await kit.secrets.get(CHATGPT_HOST_ID_REF)).toBe(hostId);
});

test("Given an unreachable revocation endpoint, when signing out, then local secrets are still cleared and reported unconfirmed", async () => {
  const captured: Captured = {};
  const openai = fakeOpenAi(captured);
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    await globalThis.fetch(callbackUrl(captured, { code: "auth-code-6", client_id: ISSUED }));
    return true;
  };
  await loginChatGptPlan(kit, kit.getProvider("openai"), adapterWith(), depsWith(captured, openai, { openUrl }));
  const failing: AuthFetch = async () => { throw new Error("network down"); };

  const result = await signOutChatGptPlan(kit, { fetch: failing });

  expect(result).toEqual({ remoteRevocationConfirmed: false });
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(await kit.getCredential("openai")).toEqual(expect.objectContaining({
    metadata: expect.objectContaining({ health: "reconnect-required" }),
  }));
});
