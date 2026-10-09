import { CHATGPT_PLAN_RESOURCE } from "./chatgpt-plan.js";
import { CHATGPT_PLAN_ADAPTER, CLIPROXYAPI_ACCOUNT_ADAPTER } from "./chatgpt-plan-credential.js";
import { ensureChatGptPlanAccess } from "./chatgpt-plan-refresh.js";
import { CHATGPT_USAGE_URL } from "./connect-protocol.js";
import { AuthKit } from "./kit.js";
export const PROXY_POLL_AFTER_MS = 2_000;
const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_API_BASE_URL = "https://api.anthropic.com/v1";
const OPENAI_CHAT_BASE_URLS = {
    cerebras: "https://api.cerebras.ai/v1",
    deepseek: "https://api.deepseek.com/v1",
    "fireworks-ai": "https://api.fireworks.ai/inference/v1",
    google: "https://generativelanguage.googleapis.com/v1beta/openai",
    groq: "https://api.groq.com/openai/v1",
    mistral: "https://api.mistral.ai/v1",
    moonshotai: "https://api.moonshot.ai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    perplexity: "https://api.perplexity.ai",
    togetherai: "https://api.together.xyz/v1",
    vercel: "https://ai-gateway.vercel.sh/v1",
    xai: "https://api.x.ai/v1",
    zai: "https://api.z.ai/api/paas/v4",
};
export function hostedApiKeyBaseUrl(providerId) {
    if (providerId === "openai")
        return OPENAI_API_BASE_URL;
    if (providerId === "anthropic")
        return ANTHROPIC_API_BASE_URL;
    return OPENAI_CHAT_BASE_URLS[providerId];
}
function healthOf(credential) {
    if (credential.type === "oauth-external" && credential.metadata.health === "reconnect-required") {
        return "reconnect-required";
    }
    return "connected";
}
export function providerConnection(provider, credential) {
    if (credential.type !== "api-key" && credential.type !== "oauth-external")
        return undefined;
    return {
        providerId: provider.id,
        providerName: provider.name,
        method: credential.type === "api-key" ? "api-key" : "account",
        ...(credential.type === "oauth-external" && credential.metadata.email !== undefined ? { account: credential.metadata.email } : {}),
        health: healthOf(credential),
        ...(credential.type === "oauth-external" && credential.metadata.adapter === CHATGPT_PLAN_ADAPTER
            ? { usage: { kind: "chatgpt-plan", manageUrl: CHATGPT_USAGE_URL } }
            : {}),
        connectedAt: credential.createdAt,
    };
}
export function summarizeStatus(providers, state) {
    const index = new Map(providers.map((provider) => [provider.id, provider]));
    const connections = Object.entries(state.credentials)
        .flatMap(([providerId, credential]) => {
        const connection = providerConnection(index.get(providerId) ?? { id: providerId, name: providerId, envVars: [], authMethods: [], models: [] }, credential);
        return connection === undefined ? [] : [connection];
    })
        .sort((left, right) => left.providerName.localeCompare(right.providerName));
    const selected = state.selectedModel;
    if (selected === undefined)
        return { connections };
    const provider = index.get(selected.providerId);
    const model = provider?.models.find((entry) => entry.id === selected.modelId) ?? selected.snapshot?.model;
    return {
        connections,
        selectedModel: {
            providerId: selected.providerId,
            modelId: selected.modelId,
            modelName: model?.name ?? selected.modelId,
        },
    };
}
export function isChatGptPlanModelId(modelId) {
    if (!modelId.startsWith("gpt-") && !/^o\d/.test(modelId))
        return false;
    return !/image|audio|realtime|tts|embedding/.test(modelId);
}
export function filterChatGptPlanModels(models) {
    return models.filter((model) => isChatGptPlanModelId(model.id));
}
export function pickDefaultModel(models) {
    const toolCapable = models.find((model) => model.tags?.includes("active") === true && model.tags.includes("tools"));
    if (toolCapable !== undefined)
        return toolCapable;
    return models.find((model) => model.tags?.includes("active") === true) ?? models[0];
}
export async function resolveConnectionRuntime(deps) {
    const state = await deps.kit.readState();
    const selected = state.selectedModel;
    if (selected === undefined)
        return undefined;
    const credential = state.credentials[selected.providerId];
    if (credential === undefined)
        return undefined;
    if (credential.type === "api-key") {
        const secret = await deps.kit.secrets.get(credential.secretRef);
        if (secret === undefined || secret.length === 0)
            return undefined;
        if (selected.providerId === "openai") {
            return { providerId: selected.providerId, modelId: selected.modelId, wire: "openai-responses", baseUrl: OPENAI_API_BASE_URL, headers: { Authorization: `Bearer ${secret}` } };
        }
        if (selected.providerId === "anthropic") {
            return { providerId: selected.providerId, modelId: selected.modelId, wire: "anthropic-messages", baseUrl: ANTHROPIC_API_BASE_URL, headers: { "x-api-key": secret, "anthropic-version": "2023-06-01" } };
        }
        const baseUrl = hostedApiKeyBaseUrl(selected.providerId);
        if (baseUrl === undefined)
            return undefined;
        return { providerId: selected.providerId, modelId: selected.modelId, wire: "openai-chat", baseUrl, headers: { Authorization: `Bearer ${secret}` } };
    }
    if (credential.type !== "oauth-external")
        return undefined;
    if (credential.metadata.adapter === CHATGPT_PLAN_ADAPTER) {
        const access = await ensureChatGptPlanAccess({
            key: `${deps.tenantId}:openai`,
            credential,
            secrets: deps.kit.secrets,
            save: async (next) => {
                const current = await deps.kit.store.read();
                await deps.kit.store.write({ ...current, credentials: { ...current.credentials, [selected.providerId]: next } });
            },
            ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
            now: deps.now,
        });
        if (access.kind !== "ready")
            return undefined;
        return { providerId: selected.providerId, modelId: selected.modelId, wire: "openai-responses", baseUrl: CHATGPT_PLAN_RESOURCE, headers: { Authorization: `Bearer ${access.accessToken}` }, planUsage: { kind: "chatgpt-plan", manageUrl: CHATGPT_USAGE_URL } };
    }
    if (credential.metadata.adapter === CLIPROXYAPI_ACCOUNT_ADAPTER) {
        if (deps.proxyAccounts === undefined)
            return undefined;
        const binding = proxyBindingFrom(credential.metadata);
        if (binding === undefined)
            return undefined;
        const route = deps.proxyAccounts.route(binding, selected.modelId);
        return { providerId: selected.providerId, modelId: route.model, wire: route.wire, baseUrl: route.baseUrl, headers: { ...route.headers } };
    }
    return undefined;
}
export function proxyBindingFrom(metadata) {
    const credentialName = metadata.credentialName;
    const routePrefix = metadata.routePrefix;
    if (credentialName === undefined || credentialName.length === 0 || routePrefix === undefined || routePrefix.length === 0)
        return undefined;
    return { credentialName, routePrefix, ...(metadata.email === undefined ? {} : { email: metadata.email }) };
}
function assertNever(value) {
    throw new Error(`Unhandled failure kind: ${String(value)}`);
}
export async function applyReportFailure(kit, failure) {
    switch (failure.kind) {
        case "auth_revoked":
        case "not_eligible":
            break;
        case "plan_limit":
            return;
        default:
            assertNever(failure.kind);
    }
    const state = await kit.store.read();
    const credential = state.credentials[failure.providerId.trim().toLowerCase()];
    if (credential === undefined || credential.type !== "oauth-external")
        return;
    if (credential.metadata.health === "reconnect-required")
        return;
    await kit.store.write({
        ...state,
        credentials: { ...state.credentials, [failure.providerId.trim().toLowerCase()]: { ...credential, metadata: { ...credential.metadata, health: "reconnect-required" } } },
        updatedAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=connect-runtime.js.map