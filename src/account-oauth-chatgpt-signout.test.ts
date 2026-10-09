import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { loginChatGptPlan, signOutChatGptPlan } from "./account-oauth-chatgpt.js";
import {
  createAdapter,
  createDeps,
  createFakeOpenAi,
  ISSUED,
  loopbackBrowser,
  type ChatGptTestCaptured,
} from "./account-oauth-chatgpt-test-helpers.js";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { CHATGPT_HOST_ID_REF } from "./credential-removal.js";
import { createProjectAuthKit, type AuthKit } from "./kit.js";
import type { AuthFetch } from "./types.js";

let dir: string;
let kit: AuthKit;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-chatgpt-signout-"));
  kit = createProjectAuthKit("test-tool", { rootDir: dir });
});

afterEach(async () => {
  resetChatGptSigningKeysForTests();
  await rm(dir, { recursive: true, force: true });
});

async function signedInKit(): Promise<{ readonly revokeCalls: { readonly url: string; readonly form: URLSearchParams }[]; readonly fetch: AuthFetch }> {
  const captured: ChatGptTestCaptured = {};
  const openai = createFakeOpenAi(captured);
  await loginChatGptPlan(kit, kit.getProvider("openai"), createAdapter(), createDeps(captured, openai.fetch, {
    openUrl: loopbackBrowser(captured, { code: "auth-code-5", client_id: ISSUED }),
  }));
  return openai;
}

test("Given a stored plan session, when signing out, then the refresh token is revoked and token secrets are cleared", async () => {
  const openai = await signedInKit();
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
  await signedInKit();
  const failing: AuthFetch = async () => { throw new Error("network down"); };

  const result = await signOutChatGptPlan(kit, { fetch: failing });

  expect(result).toEqual({ remoteRevocationConfirmed: false });
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
  expect(await kit.getCredential("openai")).toEqual(expect.objectContaining({
    metadata: expect.objectContaining({ health: "reconnect-required" }),
  }));
});
