import { refreshOpenAiCodexToken } from "./account-oauth.js";
import type { AuthKitStorage, ExternalOAuthCredential, ProviderDefinition, RuntimeAuth, StoredCredential } from "./types.js";

const OPENAI_CODEX_REFRESH_WINDOW_MS = 5 * 60_000;

type RuntimeAuthContext = {
  readonly provider: ProviderDefinition;
  readonly credential: StoredCredential | undefined;
  readonly secrets: AuthKitStorage["secrets"];
  readonly updateCredential: (credential: ExternalOAuthCredential) => Promise<void>;
};

function needsRefresh(metadata: Readonly<Record<string, string>>): boolean {
  const expiresAt = Number(metadata.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + OPENAI_CODEX_REFRESH_WINDOW_MS;
}

export async function resolveRuntimeAuth(context: RuntimeAuthContext): Promise<RuntimeAuth> {
  const { credential, provider, secrets } = context;
  const env: Record<string, string> = {};
  if (credential?.type === "api-key") {
    const value = await secrets.get(credential.secretRef);
    if (value && provider.envVars[0]) env[provider.envVars[0]] = value;
  }
  if (credential?.type === "env") {
    const value = process.env[credential.envVar];
    if (value) env[credential.envVar] = value;
  }
  if (credential?.type !== "oauth-external") return { providerId: provider.id, credential, env };

  let runtimeCredential = credential;
  let accessToken = credential.metadata.accessTokenRef ? await secrets.get(credential.metadata.accessTokenRef) : undefined;
  if (credential.metadata.adapter === "openai-codex" && credential.metadata.accessTokenRef && credential.metadata.refreshTokenRef && needsRefresh(credential.metadata)) {
    const refreshToken = await secrets.get(credential.metadata.refreshTokenRef);
    if (refreshToken) {
      const refreshed = await refreshOpenAiCodexToken(refreshToken);
      await secrets.set(credential.metadata.accessTokenRef, refreshed.accessToken);
      await secrets.set(credential.metadata.refreshTokenRef, refreshed.refreshToken);
      runtimeCredential = { ...credential, metadata: { ...credential.metadata, expiresAt: String(Date.now() + refreshed.expiresInSeconds * 1000), ...(refreshed.accountId ? { accountId: refreshed.accountId } : {}) } };
      await context.updateCredential(runtimeCredential);
      accessToken = refreshed.accessToken;
    }
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (runtimeCredential.metadata.accountId) headers["ChatGPT-Account-Id"] = runtimeCredential.metadata.accountId;
  return { providerId: provider.id, credential: runtimeCredential, env, external: { adapter: runtimeCredential.metadata.adapter ?? "oauth-external", ...(accessToken ? { accessToken } : {}), ...(runtimeCredential.metadata.expiresAt ? { expiresAt: Number(runtimeCredential.metadata.expiresAt) } : {}), ...(runtimeCredential.metadata.accountId ? { accountId: runtimeCredential.metadata.accountId } : {}), ...(runtimeCredential.metadata.baseUrl ? { baseUrl: runtimeCredential.metadata.baseUrl } : {}), headers } };
}
