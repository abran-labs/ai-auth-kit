import type { AuthKitState, AuthKitStore, SecretStore } from "./types.js";
type RemovalDependencies = {
    readonly secrets: SecretStore;
    readonly state: AuthKitState;
    readonly store: AuthKitStore;
};
export declare class CredentialRemovalError extends Error {
    readonly name = "CredentialRemovalError";
    constructor(message: string, options: ErrorOptions);
}
export declare function liveSecretRefs(state: AuthKitState): readonly string[];
export declare function removeCredentialTransaction(dependencies: RemovalDependencies, providerId: string): Promise<void>;
export {};
