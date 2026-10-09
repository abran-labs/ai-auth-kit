import { revokeChatGptSession } from "./chatgpt-plan.js";
import { CHATGPT_PLAN_ADAPTER, CLIPROXYAPI_ACCOUNT_ADAPTER } from "./chatgpt-plan-credential.js";
import { ConnectError } from "./connect-flow-state.js";
import { filterChatGptPlanModels, hostedApiKeyBaseUrl, pickDefaultModel, proxyBindingFrom, providerConnection, summarizeStatus, } from "./connect-runtime.js";
import { ProxyAccountError } from "./hosted-types.js";
function toConnectModel(model) {
    return {
        id: model.id,
        name: model.name,
        ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
        ...(model.tags === undefined ? {} : { tags: model.tags }),
    };
}
export function hostedMethods(context, provider) {
    if (provider.id === "github-copilot")
        return [];
    const offers = [];
    if (provider.authMethods.includes("api-key") && hostedApiKeyBaseUrl(provider.id) !== undefined) {
        offers.push({ method: "api-key", flow: "secret" });
    }
    if (provider.id === "openai" && context.chatGptEnabled)
        offers.push({ method: "account", flow: "chatgpt-plan" });
    if (context.proxyAccounts?.providerIds.includes(provider.id) === true) {
        offers.push({ method: "account", flow: "proxy-account" });
    }
    return offers;
}
export function providersResponse(context) {
    const featuredOrder = new Map(context.featuredIds.map((id, index) => [id, index]));
    const providers = context
        .currentProviders()
        .filter((provider) => context.isProviderAllowed(provider.id))
        .flatMap((provider) => {
        const methods = hostedMethods(context, provider).map((offer) => {
            switch (offer.flow) {
                case "secret":
                    return { method: offer.method, flow: offer.flow, label: "API key", hint: `Paste a ${provider.name} API key` };
                case "chatgpt-plan":
                    return { method: offer.method, flow: offer.flow, label: "ChatGPT plan", hint: "Use a ChatGPT Plus or Pro subscription" };
                case "proxy-account": {
                    const warning = context.proxyAccounts?.warning(provider.id) ?? "";
                    return { method: offer.method, flow: offer.flow, label: `Sign in with ${provider.name}`, ...(warning.trim().length === 0 ? {} : { risk: warning }) };
                }
            }
        });
        if (methods.length === 0)
            return [];
        return [{ id: provider.id, name: provider.name, featured: featuredOrder.has(provider.id), methods, ...(provider.docsUrl === undefined ? {} : { docsUrl: provider.docsUrl }) }];
    })
        .sort((left, right) => (featuredOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (featuredOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name));
    return { kind: "providers", providers };
}
export async function modelsFor(context, tenantId, providerId) {
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
    const credential = await context.kitFor(tenantId).getCredential(provider.id);
    if (credential?.type === "oauth-external" && credential.metadata.adapter === CLIPROXYAPI_ACCOUNT_ADAPTER) {
        const binding = proxyBindingFrom(credential.metadata);
        if (binding === undefined || context.proxyAccounts === undefined) {
            throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
        }
        try {
            return (await context.proxyAccounts.models(binding)).map(toConnectModel);
        }
        catch (error) {
            if (error instanceof ProxyAccountError)
                throw error;
            throw new ConnectError("internal", "Something went wrong. Try again.", true, { cause: error });
        }
    }
    const catalogModels = credential?.type === "oauth-external" && credential.metadata.adapter === CHATGPT_PLAN_ADAPTER && provider.id === "openai"
        ? filterChatGptPlanModels(provider.models)
        : provider.models;
    return catalogModels.map(toConnectModel);
}
export async function readConnection(context, tenantId, providerId) {
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        return undefined;
    const credential = await context.kitFor(tenantId).getCredential(provider.id);
    if (credential === undefined)
        return undefined;
    return providerConnection(provider, credential);
}
export async function ensureDefaultModel(context, tenantId, providerId) {
    const kit = context.kitFor(tenantId);
    if ((await kit.getSelectedModel()) !== undefined)
        return;
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        return;
    const fallback = pickDefaultModel(await modelsFor(context, tenantId, providerId));
    if (fallback === undefined)
        return;
    await writeSelection(kit, provider, fallback);
}
export async function statusFor(context, tenantId) {
    return { kind: "status", status: summarizeStatus(context.currentProviders(), await context.kitFor(tenantId).readState()) };
}
async function writeSelection(kit, provider, model) {
    const catalogModel = provider.models.find((entry) => entry.id === model.id);
    const snapshotModel = catalogModel ?? {
        id: model.id,
        name: model.name,
        ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
        ...(model.tags === undefined ? {} : { tags: [...model.tags] }),
    };
    const state = await kit.store.read();
    const updatedAt = new Date().toISOString();
    await kit.store.write({ ...state, selectedModel: { providerId: provider.id, modelId: snapshotModel.id, updatedAt, snapshot: { provider, model: snapshotModel } }, updatedAt });
}
export async function selectModelOp(context, tenantId, providerId, modelId) {
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
    if ((await context.kitFor(tenantId).getCredential(provider.id)) === undefined) {
        throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
    }
    const match = (await modelsFor(context, tenantId, provider.id)).find((model) => model.id === modelId);
    if (match === undefined)
        throw new ConnectError("unknown_model", `Unknown model for ${provider.name}: ${modelId}`, false);
    await writeSelection(context.kitFor(tenantId), provider, match);
    return statusFor(context, tenantId);
}
export async function disconnectOp(context, tenantId, providerId) {
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
    const kit = context.kitFor(tenantId);
    const credential = await kit.getCredential(provider.id);
    if (credential === undefined)
        throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
    if (credential.type === "oauth-external" && credential.metadata.adapter === CHATGPT_PLAN_ADAPTER) {
        const clientId = credential.metadata.clientId;
        const refreshRef = credential.metadata.refreshTokenRef;
        const refreshToken = refreshRef === undefined ? undefined : await kit.secrets.get(refreshRef);
        if (clientId !== undefined && refreshToken !== undefined) {
            await revokeChatGptSession({ clientId, refreshToken, ...(context.fetch === undefined ? {} : { fetch: context.fetch }) }).catch(() => false);
        }
    }
    if (credential.type === "oauth-external" && credential.metadata.adapter === CLIPROXYAPI_ACCOUNT_ADAPTER) {
        const binding = proxyBindingFrom(credential.metadata);
        if (binding !== undefined) {
            await context.proxyAccounts?.disconnect({ tenantId, providerId: provider.id }, binding).catch(() => undefined);
        }
    }
    await kit.removeCredential(provider.id);
    const state = await kit.store.read();
    if (state.selectedModel?.providerId === provider.id) {
        await kit.store.write({ ...state, selectedModel: undefined, updatedAt: new Date().toISOString() });
    }
    return statusFor(context, tenantId);
}
//# sourceMappingURL=connect-ops.js.map