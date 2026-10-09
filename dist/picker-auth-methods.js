import * as prompts from "@clack/prompts";
import { getCliProxyApiLabel, getCliProxyApiWarning, isAccountOAuthProvider, isCliProxyApiProvider } from "./external-auth.js";
export function getOAuthMethodLabel(provider) {
    if (isCliProxyApiProvider(provider))
        return getCliProxyApiLabel(provider);
    switch (provider.id) {
        case "openai":
            return "Sign in with ChatGPT (use your ChatGPT plan)";
        case "github-copilot":
            return "Use GitHub Copilot";
        default:
            return "Sign in with provider";
    }
}
export function getOAuthComingSoonSubject(provider) {
    switch (provider.id) {
        case "openai":
            return "ChatGPT plan sign-in";
        case "github-copilot":
            return "GitHub Copilot sign-in";
        default:
            return `${provider.name} sign-in`;
    }
}
function getApiKeyMethodLabel(provider) {
    switch (provider.id) {
        case "openai":
            return "Paste OpenAI API key";
        case "anthropic":
            return "Paste Anthropic API key";
        case "google":
            return "Paste Gemini API key";
        case "openrouter":
            return "Paste OpenRouter API key";
        default:
            return "Paste API key";
    }
}
function hasEnvValue(value) {
    return typeof value === "string" && value.trim().length > 0;
}
export function getPresentEnvVars(provider, env = process.env) {
    return provider.envVars.filter((envVar) => hasEnvValue(env[envVar]));
}
function getEnvMethodLabel(envVar) {
    return envVar ? `Use ${envVar} from shell` : "Use environment variable from shell";
}
function getEnvMethodHint(presentEnvVars) {
    if (presentEnvVars.length <= 1)
        return "Use existing shell credential";
    return `Choose from ${presentEnvVars.length} shell credentials`;
}
function getEnvOptionLabel(envVar) {
    return `Use ${envVar} from shell`;
}
export function getInteractiveAuthMethods(provider, env = process.env) {
    const presentEnvVars = getPresentEnvVars(provider, env);
    return provider.authMethods.filter((method) => {
        if (method === "env")
            return presentEnvVars.length > 0;
        if (method === "oauth-external")
            return isCliProxyApiProvider(provider) || isAccountOAuthProvider(provider);
        return true;
    });
}
export function getAuthMethodLabel(provider, method, env = process.env) {
    switch (method) {
        case "api-key":
            return getApiKeyMethodLabel(provider);
        case "env":
            return getEnvMethodLabel(getPresentEnvVars(provider, env)[0] ?? provider.envVars[0]);
        case "oauth-external":
            return getOAuthMethodLabel(provider);
        case "none":
            return "No auth needed";
    }
}
export function getAuthMethodHint(provider, method, env = process.env) {
    switch (method) {
        case "api-key":
            return "Paste once and store locally";
        case "env":
            return getEnvMethodHint(getPresentEnvVars(provider, env));
        case "oauth-external":
            return provider.id === "openai" ? "Bill usage to your ChatGPT plan" : undefined;
        case "none":
            return "Use local or unauthenticated access";
    }
}
export async function confirmExternalOAuthWarning(provider, promptAdapter) {
    if (!isCliProxyApiProvider(provider))
        return true;
    const accepted = await promptAdapter.confirm({
        message: getCliProxyApiWarning(provider),
        initialValue: false,
    });
    if (promptAdapter.isCancel(accepted))
        return false;
    return accepted;
}
//# sourceMappingURL=picker-auth-methods.js.map