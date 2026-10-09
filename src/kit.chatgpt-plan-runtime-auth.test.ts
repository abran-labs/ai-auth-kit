import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { createProjectAuthKit } from "./kit.js";

const vi = { fn: mock, spyOn };
const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-chatgpt-runtime-"));
});

afterEach(async () => {
  mock.restore();
  await rm(dir, { recursive: true, force: true });
});

function tokenFetch(body: unknown, status = 200): typeof globalThis.fetch {
  const fetch = Object.assign(vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(body, { status })), { preconnect: globalThis.fetch.preconnect });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
  return fetch;
}

async function savePlanCredential(root: string, expiresAt: number): Promise<void> {
  const kit = createProjectAuthKit("test-tool", { rootDir: root });
  await kit.secrets.set("provider:openai:oauth:access-token", "stored-access");
  await kit.secrets.set("provider:openai:oauth:refresh-token", "stored-refresh");
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_runtime",
    subject: "user-sub",
    email: "dev@example.com",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(expiresAt),
    scopes: PLAN_SCOPES,
    baseUrl: "https://api.openai.com/v1",
  });
}

test("Given a plan token inside the refresh window, when runtime auth resolves, then rotation persists and plan usage is reported", async () => {
  await savePlanCredential(dir, Date.now() + 4 * 60_000);
  const kit = createProjectAuthKit("test-tool", { rootDir: dir });
  const fetch = tokenFetch({ access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 3600, scope: PLAN_SCOPES });

  const runtime = await kit.runtimeAuth("openai");

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).toBe("https://auth.openai.com/api/accounts/oauth/token");
  expect(runtime.external).toEqual({
    adapter: "openai-chatgpt-plan",
    accessToken: "rotated-access",
    expiresAt: expect.any(Number),
    baseUrl: "https://api.openai.com/v1",
    headers: { Authorization: "Bearer rotated-access" },
    planUsage: {
      kind: "chatgpt-plan",
      manageUrl: "https://chatgpt.com/settings/usage",
      requestRules: "responses-store-false-stream-true",
    },
  });
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("rotated-access");
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("rotated-refresh");
  expect((await kit.getCredential("openai"))?.type).toBe("oauth-external");
});

test("Given a fresh plan token, when runtime auth resolves, then no refresh runs and stored access is returned", async () => {
  await savePlanCredential(dir, Date.now() + 60 * 60_000);
  const kit = createProjectAuthKit("test-tool", { rootDir: dir });
  const fetch = tokenFetch({ access_token: "unused", refresh_token: "unused", expires_in: 3600, scope: PLAN_SCOPES });

  const runtime = await kit.runtimeAuth("openai");

  expect(fetch).not.toHaveBeenCalled();
  expect(runtime.external).toEqual(expect.objectContaining({
    adapter: "openai-chatgpt-plan",
    accessToken: "stored-access",
    baseUrl: "https://api.openai.com/v1",
    planUsage: expect.objectContaining({ kind: "chatgpt-plan" }),
  }));
});

test("Given a revoked plan session, when runtime auth resolves, then reconnect-required surfaces without a token", async () => {
  await savePlanCredential(dir, Date.now() + 4 * 60_000);
  const kit = createProjectAuthKit("test-tool", { rootDir: dir });
  tokenFetch({ error: "invalid_grant" }, 400);

  const runtime = await kit.runtimeAuth("openai");

  expect(runtime.external).toEqual({
    adapter: "openai-chatgpt-plan",
    headers: {},
    health: "reconnect-required",
    planUsage: {
      kind: "chatgpt-plan",
      manageUrl: "https://chatgpt.com/settings/usage",
      requestRules: "responses-store-false-stream-true",
    },
  });
  expect(await kit.getCredential("openai")).toEqual(expect.objectContaining({
    metadata: expect.objectContaining({ health: "reconnect-required", clientId: "oaiapp_runtime" }),
  }));
});
