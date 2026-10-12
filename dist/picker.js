import * as prompts from "@clack/prompts";
import { loginAccountOAuthProvider } from "./account-oauth.js";
import { loginChatGptPlan } from "./account-oauth-chatgpt.js";
import { provisionCliProxyApiForProvider, runCliProxyApiLogin } from "./cliproxyapi.js";
import { getExternalAuthMetadata, isAccountOAuthProvider, isCliProxyApiProvider } from "./external-auth.js";
import { confirmExternalOAuthWarning, getAuthMethodHint, getAuthMethodLabel, getInteractiveAuthMethods, getOAuthComingSoonSubject, getOAuthMethodLabel, getPresentEnvVars, } from "./picker-auth-methods.js";
export { confirmExternalOAuthWarning, getAuthMethodHint, getAuthMethodLabel, getInteractiveAuthMethods, getOAuthComingSoonSubject, getOAuthMethodLabel, getPresentEnvVars, } from "./picker-auth-methods.js";
const defaultPromptAdapter = {
    isCancel: prompts.isCancel,
    autocomplete: prompts.autocomplete,
    select: prompts.select,
    confirm: prompts.confirm,
    password: prompts.password,
    text: prompts.text,
    info: (message) => {
        prompts.log.info(message);
    }
};
function isCancel(promptAdapter, value) {
    return promptAdapter.isCancel(value);
}
function getEnvOptionLabel(envVar) {
    return `Use ${envVar} from shell`;
}
export async function pickProvider(kit, message = "Select provider", promptAdapter = defaultPromptAdapter) {
    await kit.ready();
    const value = await promptAdapter.autocomplete({
        message,
        maxItems: 8,
        options: kit.listProviders().filter((provider) => getInteractiveAuthMethods(provider).length > 0).map((provider) => ({
            value: provider.id,
            label: provider.name
        }))
    });
    if (isCancel(promptAdapter, value))
        return undefined;
    return kit.getProvider(value);
}
export async function pickModel(kit, providerId, message = "Select model", promptAdapter = defaultPromptAdapter) {
    await kit.ready();
    const value = await promptAdapter.autocomplete({
        message,
        maxItems: 10,
        options: kit.listModels(providerId).map((model) => ({
            value: model.id,
            label: model.name,
            hint: model.tags?.join(", ")
        }))
    });
    if (isCancel(promptAdapter, value))
        return undefined;
    return kit.getModel(providerId, value);
}
export async function pickAuthMethod(provider, promptAdapter = defaultPromptAdapter, env = process.env) {
    const value = await promptAdapter.select({
        message: "Select auth method",
        options: getInteractiveAuthMethods(provider, env).map((method) => ({
            value: method,
            label: getAuthMethodLabel(provider, method, env),
            hint: getAuthMethodHint(provider, method, env)
        }))
    });
    if (isCancel(promptAdapter, value))
        return undefined;
    return value;
}
export async function loginWithPrompts(kit, providerId, promptAdapter = defaultPromptAdapter, options = {}) {
    await kit.ready();
    const provider = providerId ? kit.getProvider(providerId) : await pickProvider(kit, "Select provider", promptAdapter);
    if (!provider)
        return undefined;
    const method = await pickAuthMethod(provider, promptAdapter);
    if (!method)
        return undefined;
    if (method === "api-key") {
        const value = await promptAdapter.password({
            message: `Enter ${provider.name} API key`,
            validate: (input) => (input && input.trim().length > 0 ? undefined : "API key is required")
        });
        if (isCancel(promptAdapter, value))
            return undefined;
        return kit.saveApiKey(provider.id, value);
    }
    if (method === "env") {
        const presentEnvVars = getPresentEnvVars(provider);
        if (presentEnvVars.length === 0) {
            promptAdapter.info(`No ${provider.name} shell credential found. No credential was saved.`);
            return undefined;
        }
        if (presentEnvVars.length === 1) {
            return kit.saveEnvCredential(provider.id, presentEnvVars[0]);
        }
        const value = await promptAdapter.select({
            message: "Choose shell credential",
            options: presentEnvVars.map((envVar) => ({
                value: envVar,
                label: getEnvOptionLabel(envVar),
                hint: "Detected in current shell"
            }))
        });
        if (isCancel(promptAdapter, value))
            return undefined;
        return kit.saveEnvCredential(provider.id, value);
    }
    if (method === "oauth-external") {
        if (provider.id === "openai") {
            // Sign in with ChatGPT is the default account method. The legacy Codex-CLI
            // flow (loginOpenAiAccount) stays exported for compatibility but is no
            // longer offered here.
            return loginChatGptPlan(kit, provider, promptAdapter, options.chatGptPlanDeps);
        }
        if (isAccountOAuthProvider(provider)) {
            return loginAccountOAuthProvider(kit, provider, promptAdapter, options.accountOAuthDeps);
        }
        if (isCliProxyApiProvider(provider)) {
            const accepted = await confirmExternalOAuthWarning(provider, promptAdapter);
            if (!accepted)
                return undefined;
            const cliProxyApiPath = await (options.provisionCliProxyApi ?? (async (currentKit, currentProvider) => {
                const result = await provisionCliProxyApiForProvider(currentKit, currentProvider);
                return result.binaryPath;
            }))(kit, provider);
            await (options.runCliProxyApiLogin ?? runCliProxyApiLogin)(cliProxyApiPath, provider);
            const metadata = getExternalAuthMetadata(provider, { cliProxyApiPath });
            if (!metadata)
                return undefined;
            return kit.saveExternalOAuth(provider.id, metadata);
        }
        promptAdapter.info(`${getOAuthComingSoonSubject(provider)} is not available in this build. No credential was saved.`);
        return undefined;
    }
    return kit.saveNoAuth(provider.id);
}
//# sourceMappingURL=picker.js.map