import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { loginChatGptPlan } from "./account-oauth-chatgpt.js";
import {
  callbackUrl,
  captureAuthorization,
  createAdapter,
  createDeps,
  createFakeOpenAi,
  ISSUED,
  loopbackBrowser,
  PLAN_SCOPES,
  type ChatGptTestCaptured,
} from "./account-oauth-chatgpt-test-helpers.js";
import { CHATGPT_PLAN_SCOPE, CHATGPT_TOKEN_URL } from "./chatgpt-plan.js";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { CHATGPT_HOST_ID_REF } from "./credential-removal.js";
import { createProjectAuthKit, type AuthKit } from "./kit.js";
import type { PromptAdapter } from "./picker.js";

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

test("Given a first sign-in, when the browser loopback completes, then tokens are stored under the plan adapter", async () => {
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured);
  const adapter = createAdapter();

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-1", client_id: ISSUED }),
  }));

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
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured);
  let pasted = "";
  const adapter = createAdapter({
    text: (async () => pasted) as PromptAdapter["text"],
  });
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    pasted = callbackUrl(captured, { code: "auth-code-paste", client_id: ISSUED });
    return false;
  };

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, { openUrl }));

  expect(credential).toEqual(expect.objectContaining({
    type: "oauth-external",
    metadata: expect.objectContaining({ adapter: "openai-chatgpt-plan", clientId: ISSUED }),
  }));
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("access-1");
  expect(adapter.infos.join("\n")).toContain("Open this URL");
});

test("Given a declined consent, when the pasted redirect carries access_denied, then sign-in fails and nothing is saved", async () => {
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured);
  let pasted = "";
  const adapter = createAdapter({
    text: (async () => pasted) as PromptAdapter["text"],
  });
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    pasted = callbackUrl(captured, { error: "access_denied" });
    return false;
  };

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, { openUrl }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "access_denied" });

  expect(await kit.getCredential("openai")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(adapter.infos.join("\n")).toContain("declined");
});

test("Given plan usage not granted, when the code is exchanged, then sign-in fails and nothing is saved", async () => {
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured, "openid profile email offline_access");
  const adapter = createAdapter();

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-2", client_id: ISSUED }),
  }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "plan_not_granted" });

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
    expiresAt: String(Date.now() + 3600_000),
    scopes: PLAN_SCOPES,
    baseUrl: "https://api.openai.com/v1",
  });
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured, PLAN_SCOPES, "oaiapp_reauth");
  const adapter = createAdapter();

  const credential = await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-3", client_id: "oaiapp_reauth" }),
  }));

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
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured);
  await loginChatGptPlan(kit, kit.getProvider("openai"), createAdapter(), createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-4", client_id: ISSUED }),
  }));
  const hostId = await kit.secrets.get(CHATGPT_HOST_ID_REF);

  const second = createProjectAuthKit("test-tool", { rootDir: dir });

  expect(await second.secrets.get(CHATGPT_HOST_ID_REF)).toBe(hostId);
  await second.readState();
  expect(await second.secrets.get(CHATGPT_HOST_ID_REF)).toBe(hostId);
});
