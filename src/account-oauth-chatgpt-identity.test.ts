import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { loginChatGptPlan } from "./account-oauth-chatgpt.js";
import {
  createAdapter,
  createDeps,
  createFakeOpenAi,
  loopbackBrowser,
  PLAN_SCOPES,
  type ChatGptTestCaptured,
} from "./account-oauth-chatgpt-test-helpers.js";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { createProjectAuthKit, type AuthKit } from "./kit.js";

let dir: string;
let kit: AuthKit;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-chatgpt-identity-"));
  kit = createProjectAuthKit("test-tool", { rootDir: dir });
});

afterEach(async () => {
  resetChatGptSigningKeysForTests();
  await rm(dir, { recursive: true, force: true });
});

test("Given a saved CLI registration, when reauth returns a different subject, then identity_mismatch is reported and nothing is written", async () => {
  await kit.secrets.set("provider:openai:oauth:access-token", "old-access");
  await kit.secrets.set("provider:openai:oauth:refresh-token", "old-refresh");
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_reauth",
    subject: "user-sub",
    email: "reauth@example.com",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(Date.now() + 3_600_000),
    scopes: PLAN_SCOPES,
    baseUrl: "https://api.openai.com/v1",
  });
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured, PLAN_SCOPES, "oaiapp_reauth", "other-sub");
  const adapter = createAdapter();

  await expect(loginChatGptPlan(kit, kit.getProvider("openai"), adapter, createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-9", client_id: "oaiapp_reauth" }),
  }))).rejects.toMatchObject({ name: "ChatGptPlanError", code: "identity_mismatch" });

  const live = await kit.getCredential("openai");
  if (live?.type !== "oauth-external") throw new Error("Expected the saved credential");
  expect(live.metadata.subject).toBe("user-sub");
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("old-access");
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("old-refresh");
  expect(adapter.infos.join("\n")).toContain("different account");
});
