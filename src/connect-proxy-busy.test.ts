import { expect, test } from "bun:test";
import { createConnectService } from "./connect-service.js";
import { createMemoryPendingFlowStore, createMemoryTenantStore } from "./hosted-store.js";
import {
  ProxyAccountError,
  type ProxyAccountBinding,
  type ProxyAccountConnector,
  type ProxyAccountProgress,
  type ProxyAccountRoute,
  type ProxyAccountStart,
} from "./hosted-types.js";
import type { ModelDefinition, ProviderDefinition } from "./types.js";

const PROVIDERS: readonly ProviderDefinition[] = [
  { id: "anthropic", name: "Anthropic", envVars: ["ANTHROPIC_API_KEY"], authMethods: ["api-key", "oauth-external", "env"], models: [{ id: "claude-opus", name: "Claude Opus", tags: ["active", "tools"] }] },
];

class BusyProxyAccounts implements ProxyAccountConnector {
  readonly providerIds: readonly string[] = ["anthropic"];
  warning(): string {
    return "";
  }
  async start(): Promise<ProxyAccountStart> {
    throw new ProxyAccountError("login_busy", "another workspace is signing in");
  }
  async submitCallback(): Promise<void> {}
  async poll(): Promise<ProxyAccountProgress> {
    return { kind: "pending" };
  }
  async cancel(): Promise<void> {}
  async models(): Promise<readonly ModelDefinition[]> {
    return [];
  }
  async disconnect(): Promise<void> {}
  route(binding: ProxyAccountBinding, modelId: string): ProxyAccountRoute {
    return { baseUrl: binding.routePrefix, headers: {}, model: modelId, wire: "openai-chat" };
  }
}

test("Given another workspace mid sign-in, when a proxy account flow starts, then a retryable busy error is returned", async () => {
  // Given: a proxy connector whose single login slot is taken
  const service = createConnectService({
    tenantStore: createMemoryTenantStore(),
    pendingFlows: createMemoryPendingFlowStore(),
    agentName: "Test",
    hostId: "urn:uuid:7f0d8a52-9a4b-4a39-9a8e-1f1d2c3b4a5e",
    providers: PROVIDERS,
    proxyAccounts: new BusyProxyAccounts(),
  });

  // When: a tenant starts an account sign-in
  const response = await service.handle("guild-a", { op: "start", providerId: "anthropic", method: "account" });

  // Then: the host gets a retryable upstream error, never an internal fault
  expect(response).toMatchObject({ kind: "error", code: "upstream_unavailable", retryable: true });
  service.dispose();
});
