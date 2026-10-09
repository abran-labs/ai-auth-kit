import { type ChatGptPlanTokenWrite } from "./chatgpt-plan-refresh.js";
import type { AuthKitStorage, ExternalOAuthCredential, ProviderDefinition, RuntimeAuth, StoredCredential } from "./types.js";
type RuntimeAuthContext = {
    readonly provider: ProviderDefinition;
    readonly credential: StoredCredential | undefined;
    readonly secrets: AuthKitStorage["secrets"];
    readonly updateCredential: (credential: ExternalOAuthCredential, tokens?: ChatGptPlanTokenWrite) => Promise<void>;
    readonly readCurrent?: () => Promise<ExternalOAuthCredential | undefined>;
};
export declare function resolveRuntimeAuth(context: RuntimeAuthContext): Promise<RuntimeAuth>;
export {};
