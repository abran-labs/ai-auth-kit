import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { visibleProviders } from "./connect-state.js";
import { FlowView } from "./connect-flow.js";
import { ConnectionCard, DisconnectNotice, ModelPickerView, StatusNotice } from "./entity-views.js";
import { FeaturedActions } from "./featured-providers.js";
import { MethodList, ProviderCatalog } from "./provider-catalog.js";
import { useConnect } from "./use-connect.js";
const defaultLabels = {
    back: "Back",
    cancel: "Cancel",
    changeModel: "Change model",
    confirm: "Confirm",
    disconnect: "Disconnect",
    keep: "Keep",
    moreProviders: "More providers",
    openSignIn: "Open sign-in page",
    reconnect: "Reconnect",
    retry: "Retry",
    searchModels: "Search models",
    searchProviders: "Search providers",
    submit: "Submit",
    useApiKey: "Use API key",
};
export function ConnectPanel(properties) {
    const labels = { ...defaultLabels, ...(properties.labels ?? {}) };
    const featuredOnly = properties.featuredOnlyInitially ?? true;
    const controller = useConnect(properties.transport, {
        onConnected: properties.onConnected,
        onModelSelected: properties.onModelSelected,
    });
    const { state } = controller;
    const [confirmDisconnect, setConfirmDisconnect] = useState(undefined);
    const liveMessage = state.error ?? (state.phase === "loading" ? "Loading providers" : "Ready");
    const featured = state.providers.filter((provider) => provider.featured);
    const catalog = visibleProviders(state.providers, state.showAll || !featuredOnly, featuredOnly, state.filter);
    const submit = {
        onCancel: (flowId) => void controller.cancel(flowId),
        onConfirm: (flowId, accepted) => void controller.submit(flowId, { accepted, kind: "confirm" }),
        onRedirect: (flowId, value) => void controller.submit(flowId, { kind: "redirect-url", value }),
        onSecret: (flowId, value) => void controller.submit(flowId, { kind: "secret", value }),
    };
    const showCatalog = (state.phase === "idle" && (state.showAll || !featuredOnly)) ||
        state.phase === "method" ||
        state.phase === "step" ||
        state.phase === "models";
    return (_jsxs("section", { className: properties.className ?? "aak-connect", "data-aak-panel": "", children: [_jsx("h2", { "data-aak-title": "", children: properties.title ?? "Connect AI" }), _jsx("div", { "aria-live": "polite", "data-aak-status": "", children: liveMessage }), state.error === undefined ? null : (_jsx(StatusNotice, { message: state.error, onRetry: state.retryable ? () => void controller.refresh() : undefined, retryable: state.retryable })), state.notice === undefined ? null : _jsx(DisconnectNotice, { notice: state.notice }), state.phase === "loading" ? _jsx("span", { "data-aak-loading": "", children: "Loading" }) : null, state.status === undefined ? null : (_jsx("div", { "data-aak-connections": "", children: state.status.connections.map((connection) => (_jsx(ConnectionCard, { connection: connection, needsConfirm: confirmDisconnect === connection.providerId, onCancelDisconnect: () => {
                        setConfirmDisconnect(undefined);
                    }, onChangeModel: (providerId) => void controller.loadModels(providerId), onDisconnect: (providerId) => {
                        if (confirmDisconnect === providerId) {
                            setConfirmDisconnect(undefined);
                            void controller.disconnect(providerId);
                        }
                        else {
                            setConfirmDisconnect(providerId);
                        }
                    }, onReconnect: (providerId) => {
                        const provider = state.providers.find((entry) => entry.id === providerId);
                        if (provider !== undefined)
                            controller.choose(provider);
                    }, selectedModel: state.status?.selectedModel?.providerId === connection.providerId
                        ? state.status?.selectedModel?.modelName
                        : undefined }, connection.providerId))) })), state.phase === "idle" ? (_jsxs("div", { "data-aak-featured": "", children: [featured.map((provider) => (_jsx(FeaturedActions, { labels: labels, onChoose: controller.choose, onStart: (providerId, method) => void controller.start(providerId, method), provider: provider }, provider.id))), featuredOnly && !state.showAll ? (_jsx("button", { "data-aak-more-toggle": "", onClick: controller.showAll, type: "button", children: labels.moreProviders })) : null] })) : null, showCatalog ? (_jsx(ProviderCatalog, { filter: state.filter, labels: labels, onChoose: controller.choose, onFilter: controller.setFilter, providers: catalog })) : null, state.phase === "method" && state.provider !== undefined ? (_jsx(MethodList, { backLabel: labels.back, onBack: controller.back, onStart: (providerId, method) => void controller.start(providerId, method), provider: state.provider })) : null, state.phase === "step" && state.step !== undefined ? (_jsx(FlowView, { disabled: state.working && state.error === undefined, step: state.step, submit: submit })) : null, state.phase === "models" ? (_jsxs("div", { "data-aak-model-picker": "", children: [state.working ? _jsx("span", { "data-aak-loading": "", children: "Loading" }) : null, _jsx(ModelPickerView, { disabled: state.working, filter: state.modelFilter, models: state.models, onFilter: controller.setModelFilter, onSelect: (modelId) => {
                            if (state.modelsProviderId !== undefined) {
                                void controller.selectModel(state.modelsProviderId, modelId);
                            }
                        } }), _jsx("button", { "data-aak-back": "", onClick: controller.back, type: "button", children: labels.back })] })) : null] }));
}
//# sourceMappingURL=ConnectPanel.js.map