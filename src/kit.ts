import { DEFAULT_PROVIDERS } from "./catalog.js";
import { CatalogRuntime, type CatalogRefreshOptions, type CatalogStatus } from "./catalog-runtime.js";
import { resolveRuntimeAuth } from "./kit-runtime-auth.js";
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

function indexProviders(providers: readonly ProviderDefinition[]): Map<string, ProviderDefinition> {
  return new Map(providers.map((provider) => [provider.id, provider]));
}

export class AuthKit {
  readonly storage: AuthKitOptions["storage"];
  readonly store: AuthKitOptions["storage"]["store"];
  readonly secrets: AuthKitOptions["storage"]["secrets"];
  private currentProviders: readonly ProviderDefinition[];
  private providerIndex: Map<string, ProviderDefinition>;
  private readonly catalog: CatalogRuntime | undefined;

  constructor(options: AuthKitOptions) {
    this.catalog = options.providers === undefined ? new CatalogRuntime(options.catalog) : undefined;
    this.currentProviders = options.providers ?? this.catalog?.listProviders() ?? DEFAULT_PROVIDERS;
    this.storage = options.storage;
    this.store = options.storage.store;
    this.secrets = options.storage.secrets;
    this.providerIndex = indexProviders(this.currentProviders);
  }

  get providers(): readonly ProviderDefinition[] {
    return this.currentProviders;
  }

  async ready(): Promise<CatalogStatus | undefined> {
    return this.refreshCatalog();
  }

  async refreshCatalog(options: CatalogRefreshOptions = {}): Promise<CatalogStatus | undefined> {
    if (this.catalog === undefined) return undefined;
    const status = await this.catalog.refresh(options.force);
    this.setProviders(this.catalog.listProviders());
    return status;
  }

  catalogStatus(): CatalogStatus | undefined {
    return this.catalog?.catalogStatus();
  }

  startCatalogRefresh(): void {
    this.catalog?.startHourlyRefresh();
  }

  dispose(): void {
    this.catalog?.dispose();
  }

  listProviders(): readonly ProviderDefinition[] {
    return this.currentProviders;
  }

  private setProviders(providers: readonly ProviderDefinition[]): void {
    this.currentProviders = providers;
    this.providerIndex = indexProviders(providers);
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
    const selectedModel: SelectedModel = {
      providerId: provider.id,
      modelId: model.id,
      updatedAt: now(),
      snapshot: { provider, model },
    };
    await this.patchState((state) => ({ ...state, selectedModel, updatedAt: now() }));
    return selectedModel;
  }

  async getSelectedModel(): Promise<SelectedModel | undefined> {
    return (await this.readState()).selectedModel;
  }

  async resolveSelection(): Promise<ResolvedSelection | undefined> {
    const state = await this.readState();
    if (!state.selectedModel) return undefined;
    const provider = this.currentProviders.find((entry) => entry.id === state.selectedModel?.providerId);
    const model = provider?.models.find((entry) => entry.id === state.selectedModel?.modelId);
    if (provider !== undefined && model !== undefined) return { provider, model, credential: state.credentials[provider.id] };
    const snapshot = state.selectedModel.snapshot;
    if (snapshot?.provider.id !== state.selectedModel.providerId || snapshot.model.id !== state.selectedModel.modelId) return undefined;
    return { provider: snapshot.provider, model: snapshot.model, credential: state.credentials[snapshot.provider.id] };
  }

  async runtimeAuth(providerId: string): Promise<RuntimeAuth> {
    const provider = this.getProvider(providerId);
    const credential = await this.getCredential(provider.id);
    return resolveRuntimeAuth({ provider, credential, secrets: this.secrets, updateCredential: async (next) => this.patchState((state) => ({ ...state, credentials: { ...state.credentials, [provider.id]: next }, updatedAt: now() })) });
  }

  private async patchState(mutator: (state: AuthKitState) => AuthKitState): Promise<void> {
    const current = await this.store.read();
    await this.store.write(mutator(current));
  }
}

export function createAuthKit(options: AuthKitOptions): AuthKit {
  return new AuthKit(options);
}

export function createProjectAuthKit(projectName: string, options: ProjectStorageOptions & Pick<AuthKitOptions, "providers" | "catalog"> = {}): AuthKit {
  return new AuthKit({
    providers: options.providers,
    catalog: options.catalog,
    storage: projectStorage(projectName, options)
  });
}
