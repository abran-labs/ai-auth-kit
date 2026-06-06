import { DEFAULT_PROVIDERS } from "./catalog.js";
import { FileAuthKitStore, FileSecretStore, defaultConfigDir } from "./storage.js";
import type {
  AuthKitOptions,
  AuthKitState,
  AuthKitStore,
  EnvCredential,
  ExternalOAuthCredential,
  ModelDefinition,
  NoAuthCredential,
  ProviderDefinition,
  ResolvedSelection,
  RuntimeAuth,
  SecretStore,
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

function indexProviders(providers: readonly ProviderDefinition[]): Map<string, ProviderDefinition> {
  return new Map(providers.map((provider) => [provider.id, provider]));
}

export class AuthKit {
  readonly providers: readonly ProviderDefinition[];
  readonly store: AuthKitStore;
  readonly secrets: SecretStore;
  private readonly providerIndex: Map<string, ProviderDefinition>;

  constructor(options: AuthKitOptions = {}) {
    const configDir = options.configDir ?? defaultConfigDir();
    this.providers = options.providers ?? DEFAULT_PROVIDERS;
    this.store = options.store ?? new FileAuthKitStore(configDir);
    this.secrets = options.secrets ?? new FileSecretStore(configDir);
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
    return this.store.read();
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
    const credential = state.credentials[provider.id];
    if (credential?.type === "api-key") await this.secrets.delete(credential.secretRef);
    const credentials = { ...state.credentials };
    delete credentials[provider.id];
    await this.store.write({ ...state, credentials, updatedAt: now() });
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
    const provider = this.getProvider(state.selectedModel.providerId);
    const model = this.getModel(provider.id, state.selectedModel.modelId);
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

    return { providerId: provider.id, credential, env };
  }

  private async patchState(mutator: (state: AuthKitState) => AuthKitState): Promise<void> {
    const current = await this.store.read();
    await this.store.write(mutator(current));
  }
}

export function createAuthKit(options: AuthKitOptions = {}): AuthKit {
  return new AuthKit(options);
}
