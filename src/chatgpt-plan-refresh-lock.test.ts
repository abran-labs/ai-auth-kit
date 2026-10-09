import { expect, test } from "bun:test";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { ensureChatGptPlanAccess, type ChatGptPlanLock } from "./chatgpt-plan-refresh.js";
import { createMemoryTenantStore } from "./hosted-store.js";
import type { AuthFetch, ExternalOAuthCredential } from "./types.js";

const SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;

function credential(expiresAt: number): ExternalOAuthCredential {
  return {
    type: "oauth-external",
    metadata: {
      adapter: "openai-chatgpt-plan",
      clientId: "oaiapp_session",
      subject: "user-sub",
      accessTokenRef: "provider:openai:oauth:access-token",
      refreshTokenRef: "provider:openai:oauth:refresh-token",
      expiresAt: String(expiresAt),
      scopes: SCOPES,
      baseUrl: "https://api.openai.com/v1",
    },
    createdAt: "2026-10-09T00:00:00.000Z",
  };
}

function recordingLock(calls: string[]): ChatGptPlanLock {
  return async <T>(key: string, run: () => Promise<T>): Promise<T> => {
    calls.push(key);
    return run();
  };
}

test("Given a distributed lock, when another process refreshed first, then the re-read uses the newer token without refreshing", async () => {
  const tenants = createMemoryTenantStore();
  const secrets = tenants.storage("tenant-a").secrets;
  await secrets.set("provider:openai:oauth:access-token", "at-newer-process");
  await secrets.set("provider:openai:oauth:refresh-token", "rt-newer");
  let fetchCalls = 0;
  const fetch: AuthFetch = (() => {
    fetchCalls += 1;
    throw new Error("refresh must not run");
  }) as AuthFetch;
  const lockCalls: string[] = [];

  const access = await ensureChatGptPlanAccess({
    key: "tenant-a:openai",
    credential: credential(Date.now() - 60_000),
    secrets,
    save: () => Promise.resolve(),
    readCurrent: () => Promise.resolve(credential(Date.now() + 3_600_000)),
    lock: recordingLock(lockCalls),
    fetch,
  });

  if (access.kind !== "ready") throw new Error("Expected ready");
  expect(access.accessToken).toBe("at-newer-process");
  expect(fetchCalls).toBe(0);
  expect(lockCalls).toEqual(["tenant-a:openai"]);
});
