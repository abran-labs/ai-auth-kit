import { DEFAULT_PROVIDERS } from "./catalog.js";
import { refreshOpenAiCodexToken } from "./account-oauth.js";
import { liveSecretRefs, removeCredentialTransaction } from "./credential-removal.js";
import { projectStorage } from "./storage.js";
import type {
  AuthKitOptions,
  AuthKitState,
  EnvCredential,
  ExternalOAuthCredential,
  ModelDefinition,
  NoAuthCredential,
  ProjectStorageOptions,
  ProviderDefinition,
  ResolvedSelection,
  RuntimeAuth,
  SelectedModel,
  StoredCredential
} from "./types.js";

function now(): string {
  return new Date().toISOString();
}

function normalizeProviderId(providerId: string): string {
  return providerId.trim().toLowerCase();
}

function secretRef(providerId: string): string {
  return `provider:${providerId}:api-key`;
}

const OPENAI_CODEX_REFRESH_WINDOW_MS = 5 * 60_000;

function needsOpenAiCodexRefresh(metadata: Readonly<Record<string, string>>): boolean {
	const expiresAt = Number(metadata.expiresAt);
	return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + OPENAI_CODEX_REFRESH_WINDOW_MS;
}

function indexProviders(providers: readonly ProviderDefinition[]): Map<string, ProviderDefinition> {
  return new Map(providers.map((provider) => [provider.id, provider]));
}

export class AuthKit {
  readonly providers: readonly ProviderDefinition[];
  readonly storage: AuthKitOptions["storage"];
  readonly store: AuthKitOptions["storage"]["store"];
  readonly secrets: AuthKitOptions["storage"]["secrets"];
  private readonly providerIndex: Map<string, ProviderDefinition>;

  constructor(options: AuthKitOptions) {
    this.providers = options.providers ?? DEFAULT_PROVIDERS;
    this.storage = options.storage;
    this.store = options.storage.store;
    this.secrets = options.storage.secrets;
    this.providerIndex = indexProviders(this.providers);
  }

  listProviders(): readonly ProviderDefinition[] {
    return this.providers;
  }

  getProvider(providerId: string): ProviderDefinition {
    const provider = this.providerIndex.get(normalizeProviderId(providerId));
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    return provider;
  }

  listModels(providerId: string): readonly ModelDefinition[] {
    return this.getProvider(providerId).models;
  }

  getModel(providerId: string, modelId: string): ModelDefinition {
    const model = this.listModels(providerId).find((item) => item.id === modelId);
    if (!model) throw new Error(`Unknown model for ${providerId}: ${modelId}`);
    return model;
  }

  async readState(): Promise<AuthKitState> {
    const state = await this.store.read();
    await this.secrets.reconcile(liveSecretRefs(state));
    return state;
  }

  async saveApiKey(providerId: string, apiKey: string): Promise<StoredCredential> {
    const provider = this.getProvider(providerId);
    if (!provider.authMethods.includes("api-key")) throw new Error(`${provider.id} does not support API key auth`);
    if (!apiKey.trim()) throw new Error("API key is required");

    const ref = secretRef(provider.id);
    await this.secrets.set(ref, apiKey.trim());
    const credential: StoredCredential = { type: "api-key", secretRef: ref, createdAt: now() };
    await this.patchState((state) => ({
      ...state,
      credentials: { ...state.credentials, [provider.id]: credential },
      updatedAt: now()
    }));
    return credential;
  }

  async saveEnvCredential(providerId: string, envVar?: string): Promise<EnvCredential> {
    const provider = this.getProvider(providerId);
    if (!provider.authMethods.includes("env")) throw new Error(`${provider.id} does not support env auth`);
    const selectedEnvVar = envVar ?? provider.envVars[0];
    if (!selectedEnvVar) throw new Error(`${provider.id} has no known env vars`);

    const credential: EnvCredential = { type: "env", envVar: selectedEnvVar, createdAt: now() };
    await this.patchState((state) => ({
      ...state,
      credentials: { ...state.credentials, [provider.id]: credential },
      updatedAt: now()
    }));
    return credential;
  }

  async saveExternalOAuth(providerId: string, metadata: Readonly<Record<string, string>> = {}): Promise<ExternalOAuthCredential> {
    const provider = this.getProvider(providerId);
    if (!provider.authMethods.includes("oauth-external")) {
      throw new Error(`${provider.id} does not support external OAuth auth`);
    }
    const credential: ExternalOAuthCredential = { type: "oauth-external", metadata, createdAt: now() };
    await this.patchState((state) => ({
      ...state,
      credentials: { ...state.credentials, [provider.id]: credential },
      updatedAt: now()
    }));
    return credential;
  }

  async saveNoAuth(providerId: string): Promise<NoAuthCredential> {
    const provider = this.getProvider(providerId);
    if (!provider.authMethods.includes("none")) throw new Error(`${provider.id} does not support no-auth mode`);
    const credential: NoAuthCredential = { type: "none", createdAt: now() };
    await this.patchState((state) => ({
      ...state,
      credentials: { ...state.credentials, [provider.id]: credential },
      updatedAt: now()
    }));
    return credential;
  }

  async removeCredential(providerId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    const state = await this.readState();
    await removeCredentialTransaction({ store: this.store, secrets: this.secrets, state }, provider.id);
  }

  async getCredential(providerId: string): Promise<StoredCredential | undefined> {
    const provider = this.getProvider(providerId);
    const state = await this.readState();
    return state.credentials[provider.id];
  }

  async selectModel(providerId: string, modelId: string): Promise<SelectedModel> {
    const provider = this.getProvider(providerId);
    const model = this.getModel(provider.id, modelId);
    const selectedModel: SelectedModel = { providerId: provider.id, modelId: model.id, updatedAt: now() };
    await this.patchState((state) => ({ ...state, selectedModel, updatedAt: now() }));
    return selectedModel;
  }

  async getSelectedModel(): Promise<SelectedModel | undefined> {
    return (await this.readState()).selectedModel;
  }

  async resolveSelection(): Promise<ResolvedSelection | undefined> {
    const state = await this.readState();
    if (!state.selectedModel) return undefined;
		const provider = this.providers.find(
			(entry) => entry.id === state.selectedModel?.providerId,
		);
		if (!provider) return undefined;
		const model = provider.models.find(
			(entry) => entry.id === state.selectedModel?.modelId,
		);
		if (!model) return undefined;
		return { provider, model, credential: state.credentials[provider.id] };
  }

  async runtimeAuth(providerId: string): Promise<RuntimeAuth> {
    const provider = this.getProvider(providerId);
    const credential = await this.getCredential(provider.id);
    const env: Record<string, string> = {};

    if (credential?.type === "api-key") {
      const value = await this.secrets.get(credential.secretRef);
      if (value && provider.envVars[0]) env[provider.envVars[0]] = value;
    }

    if (credential?.type === "env") {
      const value = process.env[credential.envVar];
      if (value) env[credential.envVar] = value;
    }

    if (credential?.type === "oauth-external") {
      let runtimeCredential = credential;
      let accessToken = credential.metadata.accessTokenRef
        ? await this.secrets.get(credential.metadata.accessTokenRef)
        : undefined;
      let refreshToken = credential.metadata.refreshTokenRef
        ? await this.secrets.get(credential.metadata.refreshTokenRef)
        : undefined;

      if (
        credential.metadata.adapter === "openai-codex" &&
        credential.metadata.accessTokenRef &&
        credential.metadata.refreshTokenRef &&
        refreshToken &&
        needsOpenAiCodexRefresh(credential.metadata)
      ) {
        const refreshed = await refreshOpenAiCodexToken(refreshToken);
        await this.secrets.set(credential.metadata.accessTokenRef, refreshed.accessToken);
        await this.secrets.set(credential.metadata.refreshTokenRef, refreshed.refreshToken);
        const metadata = {
          ...credential.metadata,
          expiresAt: String(Date.now() + refreshed.expiresInSeconds * 1000),
          ...(refreshed.accountId ? { accountId: refreshed.accountId } : {}),
        };
        runtimeCredential = { ...credential, metadata };
        await this.patchState((state) => ({
          ...state,
          credentials: { ...state.credentials, [provider.id]: runtimeCredential },
          updatedAt: now(),
        }));
        accessToken = refreshed.accessToken;
        refreshToken = refreshed.refreshToken;
      }

      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (runtimeCredential.metadata.accountId) headers["ChatGPT-Account-Id"] = runtimeCredential.metadata.accountId;
      return {
        providerId: provider.id,
        credential: runtimeCredential,
        env,
        external: {
          adapter: runtimeCredential.metadata.adapter ?? "oauth-external",
          ...(accessToken ? { accessToken } : {}),
          ...(runtimeCredential.metadata.expiresAt ? { expiresAt: Number(runtimeCredential.metadata.expiresAt) } : {}),
          ...(runtimeCredential.metadata.accountId ? { accountId: runtimeCredential.metadata.accountId } : {}),
          ...(runtimeCredential.metadata.baseUrl ? { baseUrl: runtimeCredential.metadata.baseUrl } : {}),
          headers
        }
      };
    }

    return { providerId: provider.id, credential, env };
  }

  private async patchState(mutator: (state: AuthKitState) => AuthKitState): Promise<void> {
    const current = await this.store.read();
    await this.store.write(mutator(current));
  }
}

export function createAuthKit(options: AuthKitOptions): AuthKit {
  return new AuthKit(options);
}

export function createProjectAuthKit(projectName: string, options: ProjectStorageOptions & Pick<AuthKitOptions, "providers"> = {}): AuthKit {
  return new AuthKit({
    providers: options.providers,
    storage: projectStorage(projectName, options)
  });
}
