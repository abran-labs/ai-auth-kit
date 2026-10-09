import { expect, test } from "bun:test";
import { createChatGptHostId } from "./chatgpt-plan.js";
import { createConnectService, type ConnectService } from "./connect-service.js";
import { parseConnectResponse, type ConnectResponse, type ConnectStep } from "./connect-protocol.js";
import { createMemoryPendingFlowStore, createMemoryTenantStore, type PendingFlowStore } from "./hosted-store.js";
import type { ProviderDefinition } from "./types.js";

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] },
  { id: "gpt-4o-mini", name: "GPT-4o mini", tags: ["active", "tools"] },
];

const TEST_PROVIDERS: readonly ProviderDefinition[] = [
  { id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"], models: OPENAI_MODELS },
  { id: "anthropic", name: "Anthropic", envVars: ["ANTHROPIC_API_KEY"], authMethods: ["api-key", "env"], models: [{ id: "claude-opus", name: "Claude Opus", tags: ["active", "tools"] }] },
  { id: "mystery", name: "Mystery", envVars: ["MYSTERY_API_KEY"], authMethods: ["api-key", "env"], models: [{ id: "m-1", name: "M 1" }] },
  { id: "github-copilot", name: "GitHub Copilot", envVars: ["GITHUB_TOKEN"], authMethods: ["oauth-external", "env"], models: [{ id: "copilot", name: "Copilot" }] },
];

function setup(options: Partial<Parameters<typeof createConnectService>[0]> = {}): { readonly service: ConnectService; readonly pendingFlows: PendingFlowStore } {
  const pendingFlows = createMemoryPendingFlowStore();
  const service = createConnectService({
    tenantStore: createMemoryTenantStore(),
    pendingFlows,
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: TEST_PROVIDERS,
    ...options,
  });
  return { service, pendingFlows };
}

function stepOf(response: ConnectResponse): ConnectStep {
  parseConnectResponse(JSON.parse(JSON.stringify(response)));
  if (response.kind !== "step") throw new Error(`Expected a step, got ${response.kind}`);
  return response.step;
}

function errorOf(response: ConnectResponse): { readonly code: string; readonly message: string } {
  if (response.kind !== "error") throw new Error(`Expected an error, got ${response.kind}`);
  return response;
}

test("Given hosted providers, when listed, then featured come first and unsupported methods are excluded", async () => {
  const { service } = setup();

  const response = await service.handle("guild-a", { op: "providers" });
  if (response.kind !== "providers") throw new Error("Expected providers");

  expect(response.providers.map((provider) => provider.id)).toEqual(["openai", "anthropic"]);
  expect(response.providers[0]?.featured).toBe(true);
  expect(response.providers.find((provider) => provider.id === "openai")?.methods).toEqual([
    { method: "api-key", flow: "secret", label: "API key", hint: "Paste a OpenAI API key" },
  ]);
  expect(response.providers.some((provider) => provider.id === "github-copilot")).toBe(false);
  service.dispose();
});

test("Given an allowlist, when providers are listed, then only allowed ids appear", async () => {
  const { service } = setup({ allowProviders: (id) => id === "anthropic" });

  const response = await service.handle("guild-a", { op: "providers" });
  if (response.kind !== "providers") throw new Error("Expected providers");

  expect(response.providers.map((provider) => provider.id)).toEqual(["anthropic"]);
  expect(await service.handle("guild-a", { op: "start", providerId: "openai", method: "api-key" })).toMatchObject({ kind: "error", code: "unknown_provider" });
  service.dispose();
});

test("Given a fresh tenant, when status is read, then no connections and no selection are reported", async () => {
  const { service } = setup();

  expect(await service.handle("guild-a", { op: "status" })).toEqual({ kind: "status", status: { connections: [] } });
  expect(await service.runtime("guild-a")).toBeUndefined();
  service.dispose();
});

async function connectApiKey(service: ConnectService, tenant: string, provider = "openai", key = "sk-test-key"): Promise<void> {
  const started = stepOf(await service.handle(tenant, { op: "start", providerId: provider, method: "api-key" }));
  if (started.kind !== "secret-input") throw new Error("Expected secret-input");
  const done = stepOf(await service.handle(tenant, { op: "submit", flowId: started.flowId, input: { kind: "secret", value: key } }));
  if (done.kind !== "connected") throw new Error("Expected connected");
}

test("Given an API key flow, when completed, then status selects a default model and runtime carries the key", async () => {
  const { service } = setup();

  await connectApiKey(service, "guild-a");
  const status = await service.handle("guild-a", { op: "status" });
  if (status.kind !== "status") throw new Error("Expected status");
  expect(status.status.connections).toEqual([{ providerId: "openai", providerName: "OpenAI", method: "api-key", health: "connected", connectedAt: status.status.connections[0]?.connectedAt ?? "" }]);
  expect(status.status.selectedModel).toEqual({ providerId: "openai", modelId: "gpt-4o", modelName: "GPT-4o" });

  const runtime = await service.runtime("guild-a");
  expect(runtime).toMatchObject({ providerId: "openai", modelId: "gpt-4o", wire: "openai-responses", baseUrl: "https://api.openai.com/v1" });
  expect(runtime?.headers).toEqual({ Authorization: "Bearer sk-test-key" });
  service.dispose();
});

test("Given two tenants, when one connects, then the other cannot use its flow or credential", async () => {
  const { service } = setup();
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "openai", method: "api-key" }));
  if (started.kind !== "secret-input") throw new Error("Expected secret-input");

  expect(errorOf(await service.handle("guild-b", { op: "submit", flowId: started.flowId, input: { kind: "secret", value: "sk-x" } })).code).toBe("flow_not_found");
  expect(errorOf(await service.handle("guild-b", { op: "poll", flowId: started.flowId })).code).toBe("flow_not_found");
  expect(await service.handle("guild-b", { op: "status" })).toEqual({ kind: "status", status: { connections: [] } });

  await connectApiKey(service, "guild-a");
  expect(await service.runtime("guild-b")).toBeUndefined();
  service.dispose();
});

test("Given key validation, when the key is rejected, then the error never carries the secret", async () => {
  const secret = "sk-live-abcdef123456";
  const { service } = setup({ validateApiKey: async () => "invalid" });
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "openai", method: "api-key" }));
  if (started.kind !== "secret-input") throw new Error("Expected secret-input");

  const rejected = await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "secret", value: secret } });
  expect(errorOf(rejected).code).toBe("credential_rejected");
  expect(JSON.stringify(rejected)).not.toContain(secret);

  const missing = await service.handle("guild-a", { op: "submit", flowId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", input: { kind: "secret", value: secret } });
  expect(errorOf(missing).code).toBe("flow_not_found");
  expect(JSON.stringify(missing)).not.toContain(secret);
  service.dispose();
});

test("Given model operations, when preconditions fail, then precise codes are returned", async () => {
  const { service } = setup();

  expect(errorOf(await service.handle("guild-a", { op: "select-model", providerId: "openai", modelId: "gpt-4o" })).code).toBe("not_connected");
  await connectApiKey(service, "guild-a");
  expect(errorOf(await service.handle("guild-a", { op: "select-model", providerId: "openai", modelId: "nope" })).code).toBe("unknown_model");

  const models = await service.handle("guild-a", { op: "models", providerId: "openai" });
  if (models.kind !== "models") throw new Error("Expected models");
  expect(models.models.map((model) => model.id)).toEqual(["gpt-4o", "gpt-4o-mini"]);

  const selected = await service.handle("guild-a", { op: "select-model", providerId: "openai", modelId: "gpt-4o-mini" });
  if (selected.kind !== "status") throw new Error("Expected status");
  expect(selected.status.selectedModel?.modelId).toBe("gpt-4o-mini");
  expect((await service.runtime("guild-a"))?.modelId).toBe("gpt-4o-mini");

  const disconnected = await service.handle("guild-a", { op: "disconnect", providerId: "openai" });
  if (disconnected.kind !== "status") throw new Error("Expected status");
  expect(disconnected.status.connections).toEqual([]);
  expect(disconnected.status.selectedModel).toBeUndefined();
  expect(errorOf(await service.handle("guild-a", { op: "disconnect", providerId: "openai" })).code).toBe("not_connected");
  service.dispose();
});

test("Given bad requests, when handled, then invalid, unknown, and unavailable codes are returned", async () => {
  const { service } = setup();

  expect(errorOf(await service.handle("guild-a", { op: "nope" })).code).toBe("invalid_request");
  expect(errorOf(await service.handle("", { op: "status" })).code).toBe("invalid_request");
  expect(errorOf(await service.handle("guild-a", { op: "start", providerId: "nope", method: "api-key" })).code).toBe("unknown_provider");
  expect(errorOf(await service.handle("guild-a", { op: "start", providerId: "anthropic", method: "account" })).code).toBe("method_unavailable");
  expect(errorOf(await service.handle("guild-a", { op: "cancel", flowId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" })).code).toBe("flow_not_found");
  service.dispose();
});

test("Given an expired flow, when submitted, then flow_expired is reported and the flow is gone", async () => {
  let now = 1_000_000;
  const { service, pendingFlows } = setup({ now: () => now });
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "openai", method: "api-key" }));
  if (started.kind !== "secret-input") throw new Error("Expected secret-input");

  now += 11 * 60_000;
  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "secret", value: "sk-x" } })).code).toBe("flow_expired");
  expect(await pendingFlows.peek(started.flowId, "guild-a")).toBeUndefined();
  service.dispose();
});

test("Given a started flow, when cancelled, then the tenant can start over", async () => {
  const { service } = setup();
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "openai", method: "api-key" }));
  if (started.kind !== "secret-input") throw new Error("Expected secret-input");

  expect(await service.handle("guild-a", { op: "cancel", flowId: started.flowId })).toEqual({ kind: "cancelled" });
  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "secret", value: "sk-x" } })).code).toBe("flow_not_found");
  service.dispose();
});
