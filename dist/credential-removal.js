export class CredentialRemovalError extends Error {
    name = "CredentialRemovalError";
    constructor(message, options) { super(message, options); }
}
function refsFor(credential) {
    if (credential.type === "api-key")
        return [credential.secretRef];
    if (credential.type === "oauth-external")
        return [credential.metadata.accessTokenRef, credential.metadata.refreshTokenRef]
            .filter((ref) => typeof ref === "string" && ref.length > 0);
    return [];
}
export function liveSecretRefs(state) {
    return [...new Set(Object.values(state.credentials).flatMap(refsFor))];
}
function removedState(state, providerId) {
    const credentials = { ...state.credentials };
    delete credentials[providerId];
    return { ...state, credentials, updatedAt: new Date().toISOString() };
}
export async function removeCredentialTransaction(dependencies, providerId) {
    const next = removedState(dependencies.state, providerId);
    await dependencies.store.write(next);
    if (process.env.AI_AUTH_KIT_INTERRUPT_AT === "state-commit-sigkill")
        process.kill(process.pid, "SIGKILL");
    try {
        await dependencies.secrets.reconcile(liveSecretRefs(next));
    }
    catch (error) {
        throw new CredentialRemovalError("credential state committed; secret cleanup pending; retry", { cause: error });
    }
}
//# sourceMappingURL=credential-removal.js.map