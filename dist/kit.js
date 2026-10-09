import { DEFAULT_PROVIDERS } from "./catalog.js";
import { CatalogRuntime } from "./catalog-runtime.js";
import { isSameChatGptGeneration } from "./chatgpt-plan-refresh.js";
import { resolveRuntimeAuth } from "./kit-runtime-auth.js";
import { liveSecretRefs, removeCredentialTransaction } from "./credential-removal.js";
import { projectStorage } from "./storage.js";
function now() {
    return new Date().toISOString();
}
function normalizeProviderId(providerId) {
    return providerId.trim().toLowerCase();
}
function secretRef(providerId) {
    return `provider:${providerId}:api-key`;
}
function indexProviders(providers) {
    return new Map(providers.map((provider) => [provider.id, provider]));
}
export class AuthKit {
    storage;
    store;
    secrets;
    currentProviders;
    providerIndex;
    catalog;
    lockTail = Promise.resolve();
    constructor(options) {
        this.catalog = options.providers === undefined ? new CatalogRuntime(options.catalog) : undefined;
        this.currentProviders = options.providers ?? this.catalog?.listProviders() ?? DEFAULT_PROVIDERS;
        this.storage = options.storage;
        this.store = options.storage.store;
        this.secrets = options.storage.secrets;
        this.providerIndex = indexProviders(this.currentProviders);
    }
    get providers() {
        return this.currentProviders;
    }
    async ready() {
        return this.refreshCatalog();
    }
    async refreshCatalog(options = {}) {
        if (this.catalog === undefined)
            return undefined;
        const status = await this.catalog.refresh(options.force);
        this.setProviders(this.catalog.listProviders());
        return status;
    }
    catalogStatus() {
        return this.catalog?.catalogStatus();
    }
    startCatalogRefresh() {
        this.catalog?.startHourlyRefresh();
    }
    dispose() {
        this.catalog?.dispose();
    }
    listProviders() {
        return this.currentProviders;
    }
    setProviders(providers) {
        this.currentProviders = providers;
        this.providerIndex = indexProviders(providers);
    }
    getProvider(providerId) {
        const provider = this.providerIndex.get(normalizeProviderId(providerId));
        if (!provider)
            throw new Error(`Unknown provider: ${providerId}`);
        return provider;
    }
    listModels(providerId) {
        return this.getProvider(providerId).models;
    }
    getModel(providerId, modelId) {
        const model = this.listModels(providerId).find((item) => item.id === modelId);
        if (!model)
            throw new Error(`Unknown model for ${providerId}: ${modelId}`);
        return model;
    }
    async readState() {
        return this.runExclusive(async () => {
            const state = await this.store.read();
            await this.secrets.reconcile(liveSecretRefs(state));
            return state;
        });
    }
    async runExclusive(action) {
        const previous = this.lockTail;
        let release = () => undefined;
        this.lockTail = new Promise((resolve) => { release = resolve; });
        await previous;
        try {
            return await action();
        }
        finally {
            release();
        }
    }
    async saveApiKey(providerId, apiKey) {
        const provider = this.getProvider(providerId);
        if (!provider.authMethods.includes("api-key"))
            throw new Error(`${provider.id} does not support API key auth`);
        if (!apiKey.trim())
            throw new Error("API key is required");
        return this.runExclusive(async () => {
            const ref = secretRef(provider.id);
            await this.secrets.set(ref, apiKey.trim());
            const credential = { type: "api-key", secretRef: ref, createdAt: now() };
            await this.patchState((state) => ({
                ...state,
                credentials: { ...state.credentials, [provider.id]: credential },
                updatedAt: now()
            }));
            return credential;
        });
    }
    async saveEnvCredential(providerId, envVar) {
        const provider = this.getProvider(providerId);
        if (!provider.authMethods.includes("env"))
            throw new Error(`${provider.id} does not support env auth`);
        const selectedEnvVar = envVar ?? provider.envVars[0];
        if (!selectedEnvVar)
            throw new Error(`${provider.id} has no known env vars`);
        return this.runExclusive(async () => {
            const credential = { type: "env", envVar: selectedEnvVar, createdAt: now() };
            await this.patchState((state) => ({
                ...state,
                credentials: { ...state.credentials, [provider.id]: credential },
                updatedAt: now()
            }));
            return credential;
        });
    }
    async saveExternalOAuth(providerId, metadata = {}, secretsToSet = []) {
        const provider = this.getProvider(providerId);
        if (!provider.authMethods.includes("oauth-external")) {
            throw new Error(`${provider.id} does not support external OAuth auth`);
        }
        return this.runExclusive(async () => {
            for (const [ref, value] of secretsToSet) {
                await this.secrets.set(ref, value);
            }
            const credential = { type: "oauth-external", metadata, createdAt: now() };
            await this.patchState((state) => ({
                ...state,
                credentials: { ...state.credentials, [provider.id]: credential },
                updatedAt: now()
            }));
            return credential;
        });
    }
    async saveNoAuth(providerId) {
        const provider = this.getProvider(providerId);
        if (!provider.authMethods.includes("none"))
            throw new Error(`${provider.id} does not support no-auth mode`);
        return this.runExclusive(async () => {
            const credential = { type: "none", createdAt: now() };
            await this.patchState((state) => ({
                ...state,
                credentials: { ...state.credentials, [provider.id]: credential },
                updatedAt: now()
            }));
            return credential;
        });
    }
    async removeCredential(providerId) {
        const provider = this.getProvider(providerId);
        return this.runExclusive(async () => {
            const state = await this.store.read();
            await this.secrets.reconcile(liveSecretRefs(state));
            await removeCredentialTransaction({ store: this.store, secrets: this.secrets, state }, provider.id);
        });
    }
    async getCredential(providerId) {
        const provider = this.getProvider(providerId);
        const state = await this.readState();
        return state.credentials[provider.id];
    }
    async selectModel(providerId, modelId) {
        const provider = this.getProvider(providerId);
        const model = this.getModel(provider.id, modelId);
        return this.runExclusive(async () => {
            const selectedModel = {
                providerId: provider.id,
                modelId: model.id,
                updatedAt: now(),
                snapshot: { provider, model },
            };
            await this.patchState((state) => ({ ...state, selectedModel, updatedAt: now() }));
            return selectedModel;
        });
    }
    async getSelectedModel() {
        return (await this.readState()).selectedModel;
    }
    async resolveSelection() {
        const state = await this.readState();
        if (!state.selectedModel)
            return undefined;
        const provider = this.currentProviders.find((entry) => entry.id === state.selectedModel?.providerId);
        const model = provider?.models.find((entry) => entry.id === state.selectedModel?.modelId);
        if (provider !== undefined && model !== undefined)
            return { provider, model, credential: state.credentials[provider.id] };
        const snapshot = state.selectedModel.snapshot;
        if (snapshot?.provider.id !== state.selectedModel.providerId || snapshot.model.id !== state.selectedModel.modelId)
            return undefined;
        return { provider: snapshot.provider, model: snapshot.model, credential: state.credentials[snapshot.provider.id] };
    }
    async runtimeAuth(providerId) {
        const provider = this.getProvider(providerId);
        const credential = await this.getCredential(provider.id);
        return resolveRuntimeAuth({
            provider,
            credential,
            secrets: this.secrets,
            updateCredential: async (next, tokens) => this.runExclusive(async () => {
                const state = await this.store.read();
                const current = state.credentials[provider.id];
                if (current?.type !== "oauth-external" || !isSameChatGptGeneration(current, next))
                    return;
                if (tokens !== undefined) {
                    await this.secrets.set(tokens.accessTokenRef, tokens.accessToken);
                    await this.secrets.set(tokens.refreshTokenRef, tokens.refreshToken);
                }
                await this.store.write({ ...state, credentials: { ...state.credentials, [provider.id]: next }, updatedAt: now() });
            }),
            readCurrent: async () => {
                const state = await this.store.read();
                const current = state.credentials[provider.id];
                return current?.type === "oauth-external" ? current : undefined;
            },
        });
    }
    async patchState(mutator) {
        const current = await this.store.read();
        await this.store.write(mutator(current));
    }
}
export function createAuthKit(options) {
    return new AuthKit(options);
}
export function createProjectAuthKit(projectName, options = {}) {
    return new AuthKit({
        providers: options.providers,
        catalog: options.catalog,
        storage: projectStorage(projectName, options)
    });
}
//# sourceMappingURL=kit.js.map