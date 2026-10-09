import { z } from "zod";
import { ChatGptPlanError } from "./chatgpt-plan.js";
import { CatalogRuntime } from "./catalog-runtime.js";
import { assertNever, ConnectError, connectErrorResponse, mapChatGptError, mapProxyError } from "./connect-flow-state.js";
import { cancelFlow, pollFlow, startFlow, submitFlow } from "./connect-flows.js";
import { disconnectOp, ensureDefaultModel, hostedMethods, modelsFor, providersResponse, readConnection, selectModelOp, statusFor } from "./connect-ops.js";
import { applyReportFailure, resolveConnectionRuntime } from "./connect-runtime.js";
import { parseConnectRequest } from "./connect-protocol.js";
import { ProxyAccountError } from "./hosted-types.js";
import { AuthKit } from "./kit.js";
const DEFAULT_FEATURED = ["openai", "anthropic", "google", "openrouter"];
const DEFAULT_CALLBACK_PORT = 1455;
export function createConnectService(options) {
    if (options.agentName.trim().length === 0)
        throw new Error("agentName is required");
    if (options.hostId.trim().length === 0)
        throw new Error("hostId is required");
    const featuredIds = options.featured ?? DEFAULT_FEATURED;
    const callbackPort = options.chatGptPlan?.callbackPort ?? DEFAULT_CALLBACK_PORT;
    const chatGptEnabled = options.chatGptPlan?.enabled === true;
    const catalog = new CatalogRuntime(options.catalog);
    const kits = new Map();
    const now = options.now ?? (() => Date.now());
    function currentProviders() {
        return options.providers ?? catalog.listProviders();
    }
    function findProvider(providerId) {
        const normalized = providerId.trim().toLowerCase();
        if (options.allowProviders !== undefined && !options.allowProviders(normalized))
            return undefined;
        return currentProviders().find((provider) => provider.id === normalized);
    }
    function kitFor(tenantId) {
        const existing = kits.get(tenantId);
        if (existing !== undefined)
            return existing;
        const kit = new AuthKit({ storage: options.tenantStore.storage(tenantId), providers: currentProviders() });
        kits.set(tenantId, kit);
        return kit;
    }
    const ops = {
        findProvider,
        isProviderAllowed: (providerId) => options.allowProviders?.(providerId) ?? true,
        kitFor,
        currentProviders,
        featuredIds,
        chatGptEnabled,
        proxyAccounts: options.proxyAccounts,
        fetch: options.fetch,
    };
    const flows = {
        pendingFlows: options.pendingFlows,
        findProvider,
        hostedMethods: (provider) => hostedMethods(ops, provider),
        kitFor,
        agentName: options.agentName,
        hostId: options.hostId,
        callbackPort,
        proxyAccounts: options.proxyAccounts,
        fetch: options.fetch,
        now,
        validateApiKey: options.validateApiKey,
        readConnection: (tenantId, providerId) => readConnection(ops, tenantId, providerId),
        modelsFor: (tenantId, providerId) => modelsFor(ops, tenantId, providerId),
        ensureDefaultModel: (tenantId, providerId) => ensureDefaultModel(ops, tenantId, providerId),
    };
    function mapError(error) {
        if (error instanceof ConnectError)
            return connectErrorResponse(error.code, error.message, error.retryable);
        if (error instanceof ChatGptPlanError)
            return mapChatGptError(error);
        if (error instanceof ProxyAccountError)
            return mapProxyError(error);
        if (error instanceof z.ZodError)
            return connectErrorResponse("invalid_request", "Invalid request.", false);
        return connectErrorResponse("internal", "Something went wrong. Try again.", true);
    }
    return {
        async handle(tenantId, request) {
            try {
                if (tenantId.trim().length === 0)
                    throw new ConnectError("invalid_request", "Invalid request.", false);
                const parsed = parseConnectRequest(request);
                switch (parsed.op) {
                    case "providers":
                        return providersResponse(ops);
                    case "status":
                        return await statusFor(ops, tenantId);
                    case "start":
                        return await startFlow(flows, tenantId, parsed.providerId, parsed.method, parsed.fresh ?? false);
                    case "submit":
                        return await submitFlow(flows, tenantId, parsed.flowId, parsed.input);
                    case "poll":
                        return await pollFlow(flows, tenantId, parsed.flowId);
                    case "cancel":
                        return await cancelFlow(flows, tenantId, parsed.flowId);
                    case "models":
                        return { kind: "models", providerId: findProvider(parsed.providerId)?.id ?? parsed.providerId, models: await modelsFor(ops, tenantId, parsed.providerId) };
                    case "select-model":
                        return await selectModelOp(ops, tenantId, parsed.providerId, parsed.modelId);
                    case "disconnect":
                        return await disconnectOp(ops, tenantId, parsed.providerId);
                }
                assertNever(parsed);
            }
            catch (error) {
                return mapError(error);
            }
        },
        async runtime(tenantId) {
            if (tenantId.trim().length === 0)
                return undefined;
            try {
                return await resolveConnectionRuntime({ kit: kitFor(tenantId), tenantId, proxyAccounts: options.proxyAccounts, fetch: options.fetch, now });
            }
            catch (error) {
                if (error instanceof ChatGptPlanError || error instanceof ProxyAccountError)
                    return undefined;
                throw error;
            }
        },
        async reportFailure(tenantId, failure) {
            if (tenantId.trim().length === 0)
                return;
            await applyReportFailure(kitFor(tenantId), failure);
        },
        dispose() {
            catalog.dispose();
            kits.clear();
        },
    };
}
//# sourceMappingURL=connect-service.js.map