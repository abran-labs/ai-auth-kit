import { expect, test } from "bun:test";
import { CHATGPT_PLAN_SCOPE, createChatGptHostId } from "./chatgpt-plan.js";
import { ensureChatGptPlanAccess } from "./chatgpt-plan-refresh.js";
import { createConnectService } from "./connect-service.js";
import { createMemoryPendingFlowStore, createMemoryTenantStore } from "./hosted-store.js";
import { AuthKit } from "./kit.js";
import type { AuthFetch, ExternalOAuthCredential, ProviderDefinition } from "./types.js";

const SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;

function expiredCredential(): ExternalOAuthCredential {
  return {
    type: "oauth-external",
    metadata: {
      adapter: "openai-chatgpt-plan",
      clientId: "oaiapp_tenant",
      subject: "user-sub",
      accessTokenRef: "provider:openai:oauth:access-token",
      refreshTokenRef: "provider:openai:oauth:refresh-token",
      expiresAt: String(Date.now() - 60_000),
      scopes: SCOPES,
      baseUrl: "https://api.openai.com/v1",
    },
    createdAt: "2026-10-09T00:00:00.000Z",
  };
}

function tenantFetch(tokenFor: (refresh: string) => string, calls: string[], latencyMs: number): AuthFetch {
  return (async (_input, init) => {
    const form = new URLSearchParams(String(init?.body ?? ""));
    calls.push(form.get("refresh_token") ?? "");
    await new Promise((resolve) => { setTimeout(resolve, latencyMs); });
    const refresh = form.get("refresh_token") ?? "";
    return Response.json({ access_token: tokenFor(refresh), refresh_token: `${refresh}-next`, expires_in: 3600, scope: SCOPES });
  }) as AuthFetch;
}

test("Given two tenants with pathless stores, when both refresh under the same key, then each receives its own token", async () => {
  const tenants = createMemoryTenantStore();
  const storageA = tenants.storage("tenant-a");
  const storageB = tenants.storage("tenant-b");
  await storageA.secrets.set("provider:openai:oauth:refresh-token", "rt-a");
  await storageB.secrets.set("provider:openai:oauth:refresh-token", "rt-b");
  const calls: string[] = [];
  const fetch = tenantFetch((refresh) => `at-for-${refresh}`, calls, 20);
  const saves: ExternalOAuthCredential[] = [];

  const [accessA, accessB] = await Promise.all([
    ensureChatGptPlanAccess({
      key: "openai",
      credential: expiredCredential(),
      secrets: storageA.secrets,
      save: (credential) => { saves.push(credential); return Promise.resolve(); },
      fetch,
    }),
    ensureChatGptPlanAccess({
      key: "openai",
      credential: expiredCredential(),
      secrets: storageB.secrets,
      save: (credential) => { saves.push(credential); return Promise.resolve(); },
      fetch,
    }),
  ]);

  if (accessA.kind !== "ready" || accessB.kind !== "ready") throw new Error("Expected both tenants ready");
  expect(accessA.accessToken).toBe("at-for-rt-a");
  expect(accessB.accessToken).toBe("at-for-rt-b");
  expect(calls.sort()).toEqual(["rt-a", "rt-b"]);
});

const SERVICE_PROVIDERS: readonly ProviderDefinition[] = [
  { id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"], models: [{ id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] }] },
];

async function seedExpiredPlan(tenantStore: ReturnType<typeof createMemoryTenantStore>, refreshToken: string): Promise<void> {
  const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: SERVICE_PROVIDERS });
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_tenant",
    subject: "user-sub",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(Date.now() - 60_000),
    scopes: SCOPES,
    baseUrl: "https://api.openai.com/v1",
  }, [
    ["provider:openai:oauth:access-token", "stale-access"],
    ["provider:openai:oauth:refresh-token", refreshToken],
  ]);
  await kit.selectModel("openai", "gpt-4o");
}

function serviceFetch(tag: string, calls: string[]): AuthFetch {
  return (async (_input, init) => {
    const form = new URLSearchParams(String(init?.body ?? ""));
    calls.push(form.get("refresh_token") ?? "");
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    return Response.json({ access_token: `at-${tag}`, refresh_token: `rt-${tag}-next`, expires_in: 3600, scope: SCOPES });
  }) as AuthFetch;
}

test("Given two ConnectService instances sharing a tenant id, when both resolve runtime, then neither shares the other's token", async () => {
  const storeOne = createMemoryTenantStore();
  const storeTwo = createMemoryTenantStore();
  await seedExpiredPlan(storeOne, "rt-one");
  await seedExpiredPlan(storeTwo, "rt-two");
  const callsOne: string[] = [];
  const callsTwo: string[] = [];
  const serviceOne = createConnectService({
    tenantStore: storeOne,
    pendingFlows: createMemoryPendingFlowStore(),
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: SERVICE_PROVIDERS,
    fetch: serviceFetch("one", callsOne),
  });
  const serviceTwo = createConnectService({
    tenantStore: storeTwo,
    pendingFlows: createMemoryPendingFlowStore(),
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: SERVICE_PROVIDERS,
    fetch: serviceFetch("two", callsTwo),
  });
  try {
    const [runtimeOne, runtimeTwo] = await Promise.all([serviceOne.runtime("guild-a"), serviceTwo.runtime("guild-a")]);
    expect(runtimeOne?.headers).toEqual({ Authorization: "Bearer at-one" });
    expect(runtimeTwo?.headers).toEqual({ Authorization: "Bearer at-two" });
    expect(callsOne).toEqual(["rt-one"]);
    expect(callsTwo).toEqual(["rt-two"]);
  } finally {
    serviceOne.dispose();
    serviceTwo.dispose();
  }
});
