import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { hasApiKeyMethod, hasChatgptPlanMethod } from "./connect-state.js";
export function FeaturedActions(properties) {
    const provider = properties.provider;
    if (hasChatgptPlanMethod(provider) || hasApiKeyMethod(provider)) {
        return (_jsxs("div", { "data-aak-featured-provider": "", "data-provider": provider.id, children: [_jsx("span", { children: provider.name }), hasChatgptPlanMethod(provider) ? (_jsx("button", { "data-aak-chatgpt-continue": "", "data-aak-primary": "", onClick: () => {
                        properties.onStart(provider.id, "account");
                    }, type: "button", children: "Continue with ChatGPT" })) : null, hasApiKeyMethod(provider) ? (_jsx("button", { "data-aak-apikey": "", onClick: () => {
                        properties.onStart(provider.id, "api-key");
                    }, type: "button", children: properties.labels.useApiKey })) : null] }));
    }
    return (_jsx("button", { "data-aak-provider-button": "", "data-provider": provider.id, onClick: () => {
            properties.onChoose(provider);
        }, type: "button", children: provider.name }));
}
//# sourceMappingURL=featured-providers.js.map