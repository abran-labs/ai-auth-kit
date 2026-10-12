import { type HostedMethodOffer } from "./connect-flow-state.js";
import type { ConnectModel, ConnectResponse, Connection } from "./connect-protocol.js";
import { type ProxyAccountConnector } from "./hosted-types.js";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";
export interface ConnectOpsContext {
    readonly findProvider: (providerId: string) => ProviderDefinition | undefined;
    readonly isProviderAllowed: (providerId: string) => boolean;
    readonly kitFor: (tenantId: string) => AuthKit;
    readonly currentProviders: () => readonly ProviderDefinition[];
    readonly featuredIds: readonly string[];
    readonly chatGptEnabled: boolean;
    readonly proxyAccounts: ProxyAccountConnector | undefined;
    readonly fetch: AuthFetch | undefined;
}
export declare function hostedMethods(context: ConnectOpsContext, provider: ProviderDefinition): readonly HostedMethodOffer[];
export declare function providersResponse(context: ConnectOpsContext): ConnectResponse;
export declare function modelsFor(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<readonly ConnectModel[]>;
export declare function readConnection(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<Connection | undefined>;
export declare function ensureDefaultModel(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<void>;
export declare function statusFor(context: ConnectOpsContext, tenantId: string): Promise<ConnectResponse>;
export declare function selectModelOp(context: ConnectOpsContext, tenantId: string, providerId: string, modelId: string): Promise<ConnectResponse>;
export declare function disconnectOp(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<ConnectResponse>;
