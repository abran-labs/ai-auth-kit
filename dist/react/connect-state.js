export const initialConnectState = {
    filter: "",
    modelFilter: "",
    models: [],
    phase: "loading",
    providers: [],
    retryable: false,
    showAll: false,
    working: true,
};
function fail(state, message, retryable) {
    return { ...state, error: message, retryable, working: false };
}
export function connectReducer(state, action) {
    switch (action.kind) {
        case "load-started":
            return { ...initialConnectState };
        case "load-succeeded":
            return {
                ...state,
                error: undefined,
                phase: "idle",
                providers: action.providers,
                retryable: false,
                status: action.status,
                step: undefined,
                working: false,
            };
        case "load-failed":
            return { ...fail(state, action.message, action.retryable), phase: "idle" };
        case "show-all":
            return { ...state, showAll: true };
        case "show-featured":
            return { ...state, filter: "", showAll: false };
        case "set-filter":
            return { ...state, filter: action.filter };
        case "set-model-filter":
            return { ...state, modelFilter: action.filter };
        case "select-provider":
            return {
                ...state,
                error: undefined,
                modelFilter: "",
                models: [],
                modelsProviderId: undefined,
                phase: "method",
                provider: action.provider,
                retryable: false,
            };
        case "back-to-providers":
            return {
                ...state,
                error: undefined,
                models: [],
                modelsProviderId: undefined,
                phase: "idle",
                provider: undefined,
                retryable: false,
                step: undefined,
                working: false,
            };
        case "step-started":
            return { ...state, error: undefined, retryable: false, working: true };
        case "step-arrived":
            return {
                ...state,
                error: undefined,
                phase: "step",
                retryable: false,
                step: action.step,
                working: action.step.kind === "working",
            };
        case "step-failed":
            return { ...fail(state, action.message, action.retryable) };
        case "flow-cancelled":
            return {
                ...state,
                error: undefined,
                phase: "idle",
                provider: undefined,
                retryable: false,
                step: undefined,
                working: false,
            };
        case "models-arrived":
            return {
                ...state,
                error: undefined,
                modelFilter: "",
                models: action.models,
                modelsProviderId: action.providerId,
                phase: "models",
                retryable: false,
                working: false,
            };
        case "models-failed":
            return { ...fail(state, action.message, action.retryable) };
        case "open-models":
            return {
                ...state,
                error: undefined,
                modelFilter: "",
                models: [],
                modelsProviderId: action.providerId,
                phase: "models",
                retryable: false,
                working: true,
            };
        case "model-selected":
            return {
                ...state,
                error: undefined,
                models: [],
                modelsProviderId: undefined,
                phase: "idle",
                provider: undefined,
                retryable: false,
                step: undefined,
                working: false,
            };
        case "disconnected":
            return {
                ...state,
                error: undefined,
                models: [],
                modelsProviderId: undefined,
                phase: "idle",
                provider: undefined,
                retryable: false,
                step: undefined,
                working: false,
            };
        case "clear-error":
            return { ...state, error: undefined, retryable: false };
    }
}
export function responseError(response) {
    if (response.kind === "error")
        return { message: response.message, retryable: response.retryable };
    return undefined;
}
export function visibleProviders(providers, showAll, featuredOnlyInitially, filter) {
    const query = filter.trim().toLowerCase();
    const scoped = showAll || !featuredOnlyInitially
        ? providers
        : providers.filter((provider) => provider.featured);
    if (query === "")
        return scoped;
    return scoped.filter((provider) => provider.name.toLowerCase().includes(query) || provider.id.toLowerCase().includes(query));
}
export function hasChatgptPlanMethod(provider) {
    return provider.methods.some((option) => option.method === "account" && option.flow === "chatgpt-plan");
}
export function hasApiKeyMethod(provider) {
    return provider.methods.some((option) => option.method === "api-key");
}
export function responseFailure(response) {
    const failure = responseError(response);
    if (failure !== undefined)
        return failure;
    return { message: "connect service returned an unexpected response", retryable: false };
}
export function readStepConnection(response) {
    if (response.kind === "step" && response.step.kind === "connected")
        return response.step.connection;
    return undefined;
}
//# sourceMappingURL=connect-state.js.map