import type { AuthKitState, AuthKitStore, SecretStore } from "./types.js";
type RemovalDependencies = {
    readonly secrets: SecretStore;
    readonly state: AuthKitState;
    readonly store: AuthKitStore;
    readonly onStateCommitted?: () => void;
};
export declare class CredentialRemovalError extends Error {
    readonly name = "CredentialRemovalError";
    constructor(message: string, options: ErrorOptions);
}
export declare const HOST_SECRET_REF_PREFIX = "host:";
export declare const CHATGPT_HOST_ID_REF = "host:chatgpt:ext-agent-host-id";
export declare function isHostSecretRef(ref: string): boolean;
export declare function liveSecretRefs(state: AuthKitState): readonly string[];
export declare function removeCredentialTransaction(dependencies: RemovalDependencies, providerId: string): Promise<void>;
export {};
