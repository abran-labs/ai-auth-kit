import * as prompts from "@clack/prompts";
import { loginAccountOAuthProvider, type AccountOAuthDeps } from "./account-oauth.js";
import { loginChatGptPlan, type ChatGptPlanLoginDeps } from "./account-oauth-chatgpt.js";
import { provisionCliProxyApiForProvider, runCliProxyApiLogin } from "./cliproxyapi.js";
import {
  getExternalAuthMetadata,
  isAccountOAuthProvider,
  isCliProxyApiProvider
} from "./external-auth.js";
import type { AuthKit } from "./kit.js";
import {
  confirmExternalOAuthWarning,
  getAuthMethodHint,
  getAuthMethodLabel,
  getInteractiveAuthMethods,
  getOAuthComingSoonSubject,
  getOAuthMethodLabel,
  getPresentEnvVars,
} from "./picker-auth-methods.js";
import type { AuthMethod, ModelDefinition, ProviderDefinition, StoredCredential } from "./types.js";

export {
  confirmExternalOAuthWarning,
  getAuthMethodHint,
  getAuthMethodLabel,
  getInteractiveAuthMethods,
  getOAuthComingSoonSubject,
  getOAuthMethodLabel,
  getPresentEnvVars,
} from "./picker-auth-methods.js";
export type { ConfirmPromptAdapter, EnvMap } from "./picker-auth-methods.js";

export interface PromptAdapter {
  readonly isCancel: typeof prompts.isCancel;
  readonly autocomplete: typeof prompts.autocomplete;
  readonly select: typeof prompts.select;
  readonly confirm: typeof prompts.confirm;
  readonly password: typeof prompts.password;
  readonly text?: typeof prompts.text;
  readonly info: (message: string) => void;
}

export interface LoginWithPromptsOptions {
  readonly provisionCliProxyApi?: (kit: AuthKit, provider: ProviderDefinition) => Promise<string>;
  readonly runCliProxyApiLogin?: (binaryPath: string, provider: ProviderDefinition) => Promise<void>;
  readonly accountOAuthDeps?: AccountOAuthDeps;
  readonly chatGptPlanDeps?: ChatGptPlanLoginDeps;
}

const defaultPromptAdapter: PromptAdapter = {
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

function isCancel(promptAdapter: PromptAdapter, value: unknown): value is symbol {
  return promptAdapter.isCancel(value);
}

function getEnvOptionLabel(envVar: string): string {
  return `Use ${envVar} from shell`;
}

export async function pickProvider(
  kit: AuthKit,
  message = "Select provider",
  promptAdapter: PromptAdapter = defaultPromptAdapter
): Promise<ProviderDefinition | undefined> {
  await kit.ready();
  const value = await promptAdapter.autocomplete({
    message,
    maxItems: 8,
    options: kit.listProviders().filter((provider) => getInteractiveAuthMethods(provider).length > 0).map((provider) => ({
      value: provider.id,
      label: provider.name
    }))
  });
  if (isCancel(promptAdapter, value)) return undefined;
  return kit.getProvider(value);
}

export async function pickModel(
  kit: AuthKit,
  providerId: string,
  message = "Select model",
  promptAdapter: PromptAdapter = defaultPromptAdapter
): Promise<ModelDefinition | undefined> {
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
  if (isCancel(promptAdapter, value)) return undefined;
  return kit.getModel(providerId, value);
}

export async function pickAuthMethod(
  provider: ProviderDefinition,
  promptAdapter: PromptAdapter = defaultPromptAdapter,
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthMethod | undefined> {
  const value = await promptAdapter.select({
    message: "Select auth method",
    options: getInteractiveAuthMethods(provider, env).map((method) => ({
      value: method,
      label: getAuthMethodLabel(provider, method, env),
      hint: getAuthMethodHint(provider, method, env)
    }))
  });
  if (isCancel(promptAdapter, value)) return undefined;
  return value;
}

export async function loginWithPrompts(
  kit: AuthKit,
  providerId?: string,
  promptAdapter: PromptAdapter = defaultPromptAdapter,
  options: LoginWithPromptsOptions = {}
): Promise<StoredCredential | undefined> {
  await kit.ready();
  const provider = providerId ? kit.getProvider(providerId) : await pickProvider(kit, "Select provider", promptAdapter);
  if (!provider) return undefined;

  const method = await pickAuthMethod(provider, promptAdapter);
  if (!method) return undefined;

  if (method === "api-key") {
    const value = await promptAdapter.password({
      message: `Enter ${provider.name} API key`,
      validate: (input) => (input && input.trim().length > 0 ? undefined : "API key is required")
    });
    if (isCancel(promptAdapter, value)) return undefined;
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
    if (isCancel(promptAdapter, value)) return undefined;
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
      if (!accepted) return undefined;
      const cliProxyApiPath = await (options.provisionCliProxyApi ?? (async (currentKit, currentProvider) => {
        const result = await provisionCliProxyApiForProvider(currentKit, currentProvider);
        return result.binaryPath;
      }))(kit, provider);
      await (options.runCliProxyApiLogin ?? runCliProxyApiLogin)(cliProxyApiPath, provider);
      const metadata = getExternalAuthMetadata(provider, { cliProxyApiPath });
      if (!metadata) return undefined;
      return kit.saveExternalOAuth(provider.id, metadata);
    }
    promptAdapter.info(`${getOAuthComingSoonSubject(provider)} is not available in this build. No credential was saved.`);
    return undefined;
  }

  return kit.saveNoAuth(provider.id);
}
