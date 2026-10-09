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
  loopbackBrowser,
  PLAN_SCOPES,
  type ChatGptTestCaptured,
} from "./account-oauth-chatgpt-test-helpers.js";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { createProjectAuthKit, type AuthKit } from "./kit.js";
import type { PromptAdapter } from "./picker.js";

let dir: string;
let kit: AuthKit;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-chatgpt-declined-"));
  kit = createProjectAuthKit("test-tool", { rootDir: dir });
});

afterEach(async () => {
  resetChatGptSigningKeysForTests();
  await rm(dir, { recursive: true, force: true });
});

test("Given plan usage declined, when the code is exchanged, then plan_not_granted is reported and the disabled registration is kept", async () => {
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured, "openid profile email offline_access", "oaiapp_declined");
  const adapter = createAdapter();

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-declined", client_id: "oaiapp_declined" }),
  }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "plan_not_granted" });

  const live = await kit.getCredential("openai");
  if (live?.type !== "oauth-external") throw new Error("Expected the disabled registration");
  expect(live.metadata).toMatchObject({
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_declined",
    subject: "user-sub",
    email: "dev@example.com",
    health: "reconnect-required",
    planUsage: "disabled",
  });
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(adapter.infos.join("\n")).toContain("allow plan usage");
});

test("Given a stored id token, when signing in again, then the reauth URL carries id_token_hint but logs do not", async () => {
  await kit.secrets.set("provider:openai:oauth:id-token", "stored-id-token");
  await kit.secrets.set("provider:openai:oauth:access-token", "old-access");
  await kit.secrets.set("provider:openai:oauth:refresh-token", "old-refresh");
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_reauth",
    subject: "user-sub",
    email: "reauth@example.com",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    idTokenRef: "provider:openai:oauth:id-token",
    expiresAt: String(Date.now() + 3_600_000),
    scopes: PLAN_SCOPES,
    baseUrl: "https://api.openai.com/v1",
  });
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured, PLAN_SCOPES, "oaiapp_reauth");
  let pasted = "";
  const adapter = createAdapter({
    text: (async () => pasted) as PromptAdapter["text"],
  });
  const openUrl = async (url: string): Promise<boolean> => {
    captureAuthorization(captured)(url);
    pasted = callbackUrl(captured, { code: "auth-code-hint", client_id: "oaiapp_reauth" });
    return false;
  };

  await loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, { openUrl }));

  expect(new URL(captured.authorizationUrl ?? "").searchParams.get("id_token_hint")).toBe("stored-id-token");
  expect(adapter.infos.join("\n")).not.toContain("id_token_hint");
  expect(await kit.secrets.get("provider:openai:oauth:id-token")).not.toBe("stored-id-token");
});
