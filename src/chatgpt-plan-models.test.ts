import { expect, test } from "bun:test";
import { listChatGptPlanModels } from "./chatgpt-plan-models.js";
import { createConnectService } from "./connect-service.js";
import { createMemoryPendingFlowStore, createMemoryTenantStore } from "./hosted-store.js";
import { createChatGptHostId } from "./chatgpt-plan.js";
import { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";

const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [
      { id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] },
      { id: "gpt-image-1", name: "Image", tags: ["active"] },
    ],
  },
];

function modelsFetch(seen: { url?: string; auth?: string }, body: unknown, status = 200): AuthFetch {
  return (async (input, init) => {
    seen.url = String(input);
    const headers = new Headers(init?.headers);
    seen.auth = headers.get("authorization") ?? undefined;
    return Response.json(body, { status });
  }) as AuthFetch;
}

test("Given the plan models endpoint, when listed, then only list-visible models are kept in server order", async () => {
  const seen: { url?: string; auth?: string } = {};
  const models = await listChatGptPlanModels({
    accessToken: "live-access",
    fetch: modelsFetch(seen, {
      models: [
        { slug: "gpt-4o", display_name: "GPT-4o", visibility: "list" },
        { slug: "o3-mini", display_name: "o3 mini", visibility: "list" },
        { slug: "internal", display_name: "Internal", visibility: "unlisted" },
      ],
    }),
  });

  expect(seen.url).toBe("https://api.openai.com/v1/models");
  expect(seen.auth).toBe("Bearer live-access");
  expect(models).toEqual([
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "o3-mini", name: "o3 mini" },
  ]);
});

test("Given a standard data-shaped list, when listed, then ids are used as a fallback", async () => {
  const models = await listChatGptPlanModels({
    accessToken: "live-access",
    fetch: modelsFetch({}, { data: [{ id: "gpt-4o" }] }),
  });

  expect(models).toEqual([{ id: "gpt-4o", name: "gpt-4o" }]);
});

test("Given a failing models endpoint, when listed, then upstream_unavailable is reported", async () => {
  await expect(listChatGptPlanModels({ accessToken: "live-access", fetch: modelsFetch({}, {}, 503) }))
    .rejects.toMatchObject({ name: "ChatGptPlanError", code: "upstream_unavailable" });
  await expect(listChatGptPlanModels({ accessToken: "live-access", fetch: modelsFetch({}, { models: "nope" }) }))
    .rejects.toMatchObject({ code: "upstream_unavailable" });
  const failing: AuthFetch = (() => Promise.reject(new Error("down"))) as AuthFetch;
  await expect(listChatGptPlanModels({ accessToken: "live-access", fetch: failing }))
    .rejects.toMatchObject({ code: "upstream_unavailable" });
});

test("Given a plan connection, when hosted models are read, then the account-specific list is returned", async () => {
  const tenantStore = createMemoryTenantStore();
  const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_models",
    subject: "user-sub",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(Date.now() + 3_600_000),
    scopes: "openid chatgpt.tokens.use.direct",
    baseUrl: "https://api.openai.com/v1",
  }, [
    ["provider:openai:oauth:access-token", "live-access"],
    ["provider:openai:oauth:refresh-token", "live-refresh"],
  ]);
  const seen: { url?: string; auth?: string } = {};
  const service = createConnectService({
    tenantStore,
    pendingFlows: createMemoryPendingFlowStore(),
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: PROVIDERS,
    chatGptPlan: { enabled: true },
    fetch: modelsFetch(seen, { models: [{ slug: "gpt-4o", display_name: "GPT-4o", visibility: "list" }] }),
  });
  try {
    const response = await service.handle("guild-a", { op: "models", providerId: "openai" });
    if (response.kind !== "models") throw new Error("Expected models");
    expect(response.models).toEqual([{ id: "gpt-4o", name: "GPT-4o" }]);
    expect(seen.auth).toBe("Bearer live-access");
  } finally {
    service.dispose();
  }
});

test("Given an unreachable models endpoint, when hosted models are read, then the catalog heuristic is kept", async () => {
  const tenantStore = createMemoryTenantStore();
  const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
  await kit.saveExternalOAuth("openai", {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_models",
    subject: "user-sub",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(Date.now() + 3_600_000),
    scopes: "openid chatgpt.tokens.use.direct",
    baseUrl: "https://api.openai.com/v1",
  }, [
    ["provider:openai:oauth:access-token", "live-access"],
    ["provider:openai:oauth:refresh-token", "live-refresh"],
  ]);
  const service = createConnectService({
    tenantStore,
    pendingFlows: createMemoryPendingFlowStore(),
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: PROVIDERS,
    chatGptPlan: { enabled: true },
    fetch: modelsFetch({}, {}, 503),
  });
  try {
    const response = await service.handle("guild-a", { op: "models", providerId: "openai" });
    if (response.kind !== "models") throw new Error("Expected models");
    expect(response.models.map((model) => model.id)).toEqual(["gpt-4o"]);
  } finally {
    service.dispose();
  }
});
