import { type CatalogRuntimeOptions } from "./catalog-runtime.js";
import { type ApiKeyVerdict } from "./connect-flow-state.js";
import { type ReportFailure } from "./connect-runtime.js";
import { type ConnectResponse } from "./connect-protocol.js";
import type { HostedTenantStore, PendingFlowStore } from "./hosted-store.js";
import { type ConnectionRuntime, type ProxyAccountConnector } from "./hosted-types.js";
import type { ChatGptPlanLock } from "./chatgpt-plan-refresh.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";
export type { ReportFailure };
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
    readonly lock?: ChatGptPlanLock;
    readonly catalog?: CatalogRuntimeOptions;
    readonly validateApiKey?: (providerId: string, key: string) => Promise<ApiKeyVerdict>;
}
export interface ConnectService {
    handle(tenantId: string, request: unknown): Promise<ConnectResponse>;
    runtime(tenantId: string): Promise<ConnectionRuntime | undefined>;
    reportFailure(tenantId: string, failure: ReportFailure): Promise<void>;
    dispose(): void;
}
export declare function createConnectService(options: ConnectServiceOptions): ConnectService;
