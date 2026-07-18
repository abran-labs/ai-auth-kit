import type { AuthKitState, AuthKitStore, SecretStore, StoredCredential } from "./types.js";

type RemovalDependencies = { readonly secrets: SecretStore; readonly state: AuthKitState; readonly store: AuthKitStore; };

export class CredentialRemovalError extends Error {
  readonly name = "CredentialRemovalError";
  constructor(message: string, options: ErrorOptions) { super(message, options); }
}

function refsFor(credential: StoredCredential): readonly string[] {
  if (credential.type === "api-key") return [credential.secretRef];
  if (credential.type === "oauth-external") return [credential.metadata.accessTokenRef, credential.metadata.refreshTokenRef]
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  return [];
}

export function liveSecretRefs(state: AuthKitState): readonly string[] {
  return [...new Set(Object.values(state.credentials).flatMap(refsFor))];
}

function removedState(state: AuthKitState, providerId: string): AuthKitState {
  const credentials = { ...state.credentials };
  delete credentials[providerId];
  return { ...state, credentials, updatedAt: new Date().toISOString() };
}

export async function removeCredentialTransaction(dependencies: RemovalDependencies, providerId: string): Promise<void> {
  const next = removedState(dependencies.state, providerId);
  await dependencies.store.write(next);
  if (process.env.AI_AUTH_KIT_INTERRUPT_AT === "state-commit-sigkill") process.kill(process.pid, "SIGKILL");
  try {
    await dependencies.secrets.reconcile(liveSecretRefs(next));
  } catch (error) {
    throw new CredentialRemovalError("credential state committed; secret cleanup pending; retry", { cause: error });
  }
}
