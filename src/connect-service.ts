import { z } from "zod";
import { ChatGptPlanError } from "./chatgpt-plan.js";
import { CatalogRuntime, type CatalogRuntimeOptions } from "./catalog-runtime.js";
import { assertNever, ConnectError, connectErrorResponse, mapChatGptError, mapProxyError, type ApiKeyVerdict, type ConnectFlowContext } from "./connect-flow-state.js";
import { cancelFlow, pollFlow, startFlow, submitFlow } from "./connect-flows.js";
import { disconnectOp, ensureDefaultModel, hostedMethods, modelsFor, providersResponse, readConnection, selectModelOp, statusFor, type ConnectOpsContext } from "./connect-ops.js";
import { applyReportFailure, resolveConnectionRuntime, type ReportFailure } from "./connect-runtime.js";
import { parseConnectRequest, type ConnectMethod, type ConnectResponse } from "./connect-protocol.js";
import type { HostedTenantStore, PendingFlowStore } from "./hosted-store.js";
import { ProxyAccountError, type ConnectionRuntime, type ProxyAccountConnector } from "./hosted-types.js";
import { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";

export type { ReportFailure };

const DEFAULT_FEATURED = ["openai", "anthropic", "google", "openrouter"];
const DEFAULT_CALLBACK_PORT = 1455;

export interface ChatGptPlanHostOptions {
  readonly enabled: boolean;
  readonly callbackPort?: number;
}

export interface ConnectServiceOptions {
  readonly tenantStore: HostedTenantStore;
  readonly pendingFlows: PendingFlowStore;
  readonly agentName: string;
  readonly hostId: string;
  readonly providers?: readonly ProviderDefinition[];
  readonly featured?: readonly string[];
  readonly allowProviders?: (id: string) => boolean;
  readonly chatGptPlan?: ChatGptPlanHostOptions;
  readonly proxyAccounts?: ProxyAccountConnector;
  readonly fetch?: AuthFetch;
  readonly now?: () => number;
  readonly catalog?: CatalogRuntimeOptions;
  readonly validateApiKey?: (providerId: string, key: string) => Promise<ApiKeyVerdict>;
}

export interface ConnectService {
  handle(tenantId: string, request: unknown): Promise<ConnectResponse>;
  runtime(tenantId: string): Promise<ConnectionRuntime | undefined>;
  reportFailure(tenantId: string, failure: ReportFailure): Promise<void>;
  dispose(): void;
}

export function createConnectService(options: ConnectServiceOptions): ConnectService {
  if (options.agentName.trim().length === 0) throw new Error("agentName is required");
  if (options.hostId.trim().length === 0) throw new Error("hostId is required");
  const featuredIds = options.featured ?? DEFAULT_FEATURED;
  const callbackPort = options.chatGptPlan?.callbackPort ?? DEFAULT_CALLBACK_PORT;
  const chatGptEnabled = options.chatGptPlan?.enabled === true;
  const catalog = new CatalogRuntime(options.catalog);
  const kits = new Map<string, AuthKit>();
  const now = options.now ?? (() => Date.now());

  function currentProviders(): readonly ProviderDefinition[] {
    return options.providers ?? catalog.listProviders();
  }

  function findProvider(providerId: string): ProviderDefinition | undefined {
    const normalized = providerId.trim().toLowerCase();
    if (options.allowProviders !== undefined && !options.allowProviders(normalized)) return undefined;
    return currentProviders().find((provider) => provider.id === normalized);
  }

  function kitFor(tenantId: string): AuthKit {
    const existing = kits.get(tenantId);
    if (existing !== undefined) return existing;
    const kit = new AuthKit({ storage: options.tenantStore.storage(tenantId), providers: currentProviders() });
    kits.set(tenantId, kit);
    return kit;
  }

  const ops: ConnectOpsContext = {
    findProvider,
    isProviderAllowed: (providerId) => options.allowProviders?.(providerId) ?? true,
    kitFor,
    currentProviders,
    featuredIds,
    chatGptEnabled,
    proxyAccounts: options.proxyAccounts,
    fetch: options.fetch,
  };

  const flows: ConnectFlowContext = {
    pendingFlows: options.pendingFlows,
    findProvider,
    hostedMethods: (provider) => hostedMethods(ops, provider),
    kitFor,
    agentName: options.agentName,
    hostId: options.hostId,
    callbackPort,
    proxyAccounts: options.proxyAccounts,
    fetch: options.fetch,
    now,
    validateApiKey: options.validateApiKey,
    readConnection: (tenantId, providerId) => readConnection(ops, tenantId, providerId),
    modelsFor: (tenantId, providerId) => modelsFor(ops, tenantId, providerId),
    ensureDefaultModel: (tenantId, providerId) => ensureDefaultModel(ops, tenantId, providerId),
  };

  function mapError(error: unknown): ConnectResponse {
    if (error instanceof ConnectError) return connectErrorResponse(error.code, error.message, error.retryable);
    if (error instanceof ChatGptPlanError) return mapChatGptError(error);
    if (error instanceof ProxyAccountError) return mapProxyError(error);
    if (error instanceof z.ZodError) return connectErrorResponse("invalid_request", "Invalid request.", false);
    return connectErrorResponse("internal", "Something went wrong. Try again.", true);
  }

  return {
    async handle(tenantId: string, request: unknown): Promise<ConnectResponse> {
      try {
        if (tenantId.trim().length === 0) throw new ConnectError("invalid_request", "Invalid request.", false);
        const parsed = parseConnectRequest(request);
        switch (parsed.op) {
          case "providers":
            return providersResponse(ops);
          case "status":
            return await statusFor(ops, tenantId);
          case "start":
            return await startFlow(flows, tenantId, parsed.providerId, parsed.method satisfies ConnectMethod, parsed.fresh ?? false);
          case "submit":
            return await submitFlow(flows, tenantId, parsed.flowId, parsed.input);
          case "poll":
            return await pollFlow(flows, tenantId, parsed.flowId);
          case "cancel":
            return await cancelFlow(flows, tenantId, parsed.flowId);
          case "models":
            return { kind: "models", providerId: findProvider(parsed.providerId)?.id ?? parsed.providerId, models: await modelsFor(ops, tenantId, parsed.providerId) };
          case "select-model":
            return await selectModelOp(ops, tenantId, parsed.providerId, parsed.modelId);
          case "disconnect":
            return await disconnectOp(ops, tenantId, parsed.providerId);
        }
        assertNever(parsed);
      } catch (error) {
        return mapError(error);
      }
    },

    async runtime(tenantId: string): Promise<ConnectionRuntime | undefined> {
      if (tenantId.trim().length === 0) return undefined;
      try {
        return await resolveConnectionRuntime({ kit: kitFor(tenantId), tenantId, proxyAccounts: options.proxyAccounts, fetch: options.fetch, now });
      } catch (error) {
        if (error instanceof ChatGptPlanError || error instanceof ProxyAccountError) return undefined;
        throw error;
      }
    },

    async reportFailure(tenantId: string, failure: ReportFailure): Promise<void> {
      if (tenantId.trim().length === 0) return;
      await applyReportFailure(kitFor(tenantId), failure);
    },

    dispose(): void {
      catalog.dispose();
      kits.clear();
    },
  };
}
