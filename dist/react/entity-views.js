import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
export function StatusNotice(properties) {
    return (_jsxs("div", { "data-aak-error": "", role: "alert", children: [_jsx("span", { children: properties.message }), properties.retryable && properties.onRetry !== undefined ? (_jsx("button", { "data-aak-retry": "", onClick: properties.onRetry, type: "button", children: "Retry" })) : null] }));
}
export function ConnectionCard(properties) {
    const connection = properties.connection;
    return (_jsxs("div", { "data-aak-connection": "", "data-provider": connection.providerId, children: [_jsx("span", { "data-aak-connection-name": "", children: connection.providerName }), connection.account === undefined ? null : (_jsx("span", { "data-aak-connection-account": "", children: connection.account })), connection.health === "reconnect-required" ? (_jsx("span", { "data-aak-health": "reconnect-required", children: "Reconnect needed" })) : (_jsx("span", { "data-aak-health": "connected", children: "Connected" })), connection.usage === undefined ? null : (_jsxs("span", { "data-aak-usage": "", children: ["Using ChatGPT plan", " ", _jsx("a", { "data-aak-usage-link": "", href: connection.usage.manageUrl, children: "Manage usage" })] })), properties.selectedModel === undefined ? null : (_jsx("span", { "data-aak-model": "", children: properties.selectedModel })), _jsx("button", { "data-aak-change-model": "", onClick: () => {
                    properties.onChangeModel(connection.providerId);
                }, type: "button", children: "Change model" }), connection.health === "reconnect-required" ? (_jsx("button", { "data-aak-reconnect": "", onClick: () => {
                    properties.onReconnect(connection.providerId);
                }, type: "button", children: "Reconnect" })) : null, properties.needsConfirm ? (_jsxs("span", { "data-aak-disconnect-confirm": "", children: [_jsx("button", { "data-aak-disconnect-yes": "", onClick: () => {
                            properties.onDisconnect(connection.providerId);
                        }, type: "button", children: "Confirm disconnect" }), _jsx("button", { "data-aak-disconnect-no": "", onClick: properties.onCancelDisconnect, type: "button", children: "Keep" })] })) : null, properties.needsConfirm ? null : (_jsx("button", { "data-aak-disconnect": "", onClick: () => {
                    properties.onDisconnect(connection.providerId);
                }, type: "button", children: "Disconnect" }))] }));
}
export function ModelPickerView(properties) {
    const filterId = useId();
    const query = properties.filter.trim().toLowerCase();
    const visible = query === ""
        ? properties.models
        : properties.models.filter((model) => model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query));
    return (_jsxs("div", { "data-aak-models": "", children: [_jsx("label", { htmlFor: filterId, children: "Search models" }), _jsx("input", { autoFocus: true, "data-aak-model-filter": "", id: filterId, onChange: (event) => {
                    properties.onFilter(event.currentTarget.value);
                }, type: "text", value: properties.filter }), _jsx("ul", { "data-aak-model-list": "", children: visible.map((model) => (_jsx("li", { "data-aak-model-option": "", "data-model": model.id, children: _jsx("button", { "data-aak-model-select": "", disabled: properties.disabled, onClick: () => {
                            properties.onSelect(model.id);
                        }, type: "button", children: model.name }) }, model.id))) })] }));
}
//# sourceMappingURL=entity-views.js.map