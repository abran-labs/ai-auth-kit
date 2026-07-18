export const CLIPROXYAPI_BASE_URL = "http://localhost:8317";
const cliProxyApiProviders = new Set(["anthropic", "google"]);
const accountOAuthProviders = new Set(["openai", "github-copilot"]);
function normalizeProviderId(provider) {
    return typeof provider === "string" ? provider.trim().toLowerCase() : provider.id;
}
export function isCliProxyApiProvider(provider) {
    return cliProxyApiProviders.has(normalizeProviderId(provider));
}
export function isAccountOAuthProvider(provider) {
    return accountOAuthProviders.has(normalizeProviderId(provider));
}
export function isExternalOAuthProvider(provider) {
    return isCliProxyApiProvider(provider) || isAccountOAuthProvider(provider);
}
export function getExternalAuthMetadata(provider, options = {}) {
    const providerId = normalizeProviderId(provider);
    if (providerId !== "anthropic" && providerId !== "google")
        return undefined;
    return {
        adapter: "cliproxyapi",
        provider: providerId,
        baseUrl: CLIPROXYAPI_BASE_URL,
        warningAccepted: "true",
        ...(options.cliProxyApiPath ? { cliProxyApiPath: options.cliProxyApiPath } : {})
    };
}
export function getCliProxyApiLabel(provider) {
    switch (provider.id) {
        case "anthropic":
            return "Sign in with Claude (use at your own risk)";
        case "google":
            return "Sign in with Gemini (use at your own risk)";
        default:
            return "Sign in (use at your own risk)";
    }
}
export function getCliProxyApiWarning(provider) {
    const product = provider.id === "anthropic" ? "Claude" : "Gemini";
    return `${product} via CLIProxyAPI uses external/unofficial account-routing flows. It may violate provider terms and can get your account blocked or limited. Continue only if you accept that risk. ai-auth-kit will provision local CLIProxyAPI access for ${CLIPROXYAPI_BASE_URL} on first use when needed.`;
}
//# sourceMappingURL=external-auth.js.map