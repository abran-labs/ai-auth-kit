import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
export function ProviderCatalog(properties) {
    const filterId = useId();
    return (_jsxs("div", { "data-aak-catalog": "", children: [_jsx("label", { htmlFor: filterId, children: properties.labels.searchProviders }), _jsx("input", { "data-aak-provider-filter": "", id: filterId, onChange: (event) => {
                    properties.onFilter(event.currentTarget.value);
                }, type: "text", value: properties.filter }), _jsx("ul", { "data-aak-provider-list": "", children: properties.providers.map((provider) => (_jsx("li", { "data-aak-provider-option": "", "data-provider": provider.id, children: _jsx("button", { "data-aak-provider-button": "", onClick: () => {
                            properties.onChoose(provider);
                        }, type: "button", children: provider.name }) }, provider.id))) })] }));
}
export function MethodList(properties) {
    const provider = properties.provider;
    return (_jsxs("div", { "data-aak-method-list": "", children: [_jsx("span", { children: provider.name }), provider.methods.map((option) => (_jsx("button", { "data-aak-method-button": "", "data-flow": option.flow, "data-method": option.method, onClick: () => {
                    properties.onStart(provider.id, option.method);
                }, type: "button", children: option.label }, `${option.method}:${option.flow}`))), _jsx("button", { "data-aak-back": "", onClick: properties.onBack, type: "button", children: properties.backLabel })] }));
}
//# sourceMappingURL=provider-catalog.js.map