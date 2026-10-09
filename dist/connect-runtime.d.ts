import { type ConnectStatus, type Connection } from "./connect-protocol.js";
import type { ProxyAccountBinding, ProxyAccountConnector } from "./hosted-types.js";
import { AuthKit } from "./kit.js";
import type { AuthFetch, AuthKitState, ModelDefinition, ProviderDefinition, StoredCredential } from "./types.js";
export declare const PROXY_POLL_AFTER_MS = 2000;
export declare function hostedApiKeyBaseUrl(providerId: string): string | undefined;
export declare function providerConnection(provider: ProviderDefinition, credential: StoredCredential): Connection | undefined;
export declare function summarizeStatus(providers: readonly ProviderDefinition[], state: AuthKitState): ConnectStatus;
export declare function isChatGptPlanModelId(modelId: string): boolean;
export declare function filterChatGptPlanModels(models: readonly ModelDefinition[]): readonly ModelDefinition[];
export declare function pickDefaultModel(models: readonly ModelDefinition[]): ModelDefinition | undefined;
export interface ConnectionRuntimeDeps {
    readonly kit: AuthKit;
    readonly tenantId: string;
    readonly proxyAccounts: ProxyAccountConnector | undefined;
    readonly fetch: AuthFetch | undefined;
    readonly now: () => number;
}
export declare function resolveConnectionRuntime(deps: ConnectionRuntimeDeps): Promise<import("./hosted-types.js").ConnectionRuntime | undefined>;
export declare function proxyBindingFrom(metadata: Readonly<Record<string, string>>): ProxyAccountBinding | undefined;
export type FailureKind = "auth_revoked" | "plan_limit" | "not_eligible";
export interface ReportFailure {
    readonly providerId: string;
    readonly kind: FailureKind;
}
export declare function applyReportFailure(kit: AuthKit, failure: ReportFailure): Promise<void>;
