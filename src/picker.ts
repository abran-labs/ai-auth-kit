import * as prompts from "@clack/prompts";
import { loginAccountOAuthProvider, type AccountOAuthDeps } from "./account-oauth.js";
import { provisionCliProxyApiForProvider, runCliProxyApiLogin } from "./cliproxyapi.js";
import {
	getCliProxyApiLabel,
	getCliProxyApiWarning,
	getExternalAuthMetadata,
	isAccountOAuthProvider,
	isCliProxyApiProvider
} from "./external-auth.js";
import type { AuthKit } from "./kit.js";
import type { AuthMethod, ModelDefinition, ProviderDefinition, StoredCredential } from "./types.js";

type EnvMap = NodeJS.ProcessEnv;

export interface PromptAdapter {
  readonly isCancel: typeof prompts.isCancel;
  readonly autocomplete: typeof prompts.autocomplete;
  readonly select: typeof prompts.select;
  readonly confirm: typeof prompts.confirm;
  readonly password: typeof prompts.password;
  readonly info: (message: string) => void;
}

export interface LoginWithPromptsOptions {
  readonly provisionCliProxyApi?: (kit: AuthKit, provider: ProviderDefinition) => Promise<string>;
  readonly runCliProxyApiLogin?: (binaryPath: string, provider: ProviderDefinition) => Promise<void>;
  readonly accountOAuthDeps?: AccountOAuthDeps;
}

const defaultPromptAdapter: PromptAdapter = {
  isCancel: prompts.isCancel,
  autocomplete: prompts.autocomplete,
  select: prompts.select,
  confirm: prompts.confirm,
  password: prompts.password,
  info: (message) => {
    prompts.log.info(message);
  }
};

function isCancel(promptAdapter: PromptAdapter, value: unknown): value is symbol {
  return promptAdapter.isCancel(value);
}

export function getOAuthMethodLabel(provider: ProviderDefinition): string {
	if (isCliProxyApiProvider(provider)) return getCliProxyApiLabel(provider);
	switch (provider.id) {
		case "openai":
			return "Use ChatGPT Plus/Pro (browser sign-in)";
		case "github-copilot":
			return "Use GitHub Copilot";
		default:
      return "Sign in with provider";
  }
}

export function getOAuthComingSoonSubject(provider: ProviderDefinition): string {
  switch (provider.id) {
    case "openai":
      return "ChatGPT Plus/Pro sign-in";
    case "github-copilot":
      return "GitHub Copilot sign-in";
    default:
      return `${provider.name} sign-in`;
  }
}

function getApiKeyMethodLabel(provider: ProviderDefinition): string {
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

function hasEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getPresentEnvVars(provider: ProviderDefinition, env: EnvMap = process.env): string[] {
  return provider.envVars.filter((envVar) => hasEnvValue(env[envVar]));
}

function getEnvMethodLabel(envVar: string | undefined): string {
  return envVar ? `Use ${envVar} from shell` : "Use environment variable from shell";
}

function getEnvMethodHint(presentEnvVars: readonly string[]): string | undefined {
  if (presentEnvVars.length <= 1) return "Use existing shell credential";
  return `Choose from ${presentEnvVars.length} shell credentials`;
}

function getEnvOptionLabel(envVar: string): string {
  return `Use ${envVar} from shell`;
}

export function getInteractiveAuthMethods(provider: ProviderDefinition, env: EnvMap = process.env): AuthMethod[] {
  const presentEnvVars = getPresentEnvVars(provider, env);
  return provider.authMethods.filter((method) => {
    if (method === "env") return presentEnvVars.length > 0;
    if (method === "oauth-external") return isCliProxyApiProvider(provider) || isAccountOAuthProvider(provider);
    return true;
  });
}

export function getAuthMethodLabel(provider: ProviderDefinition, method: AuthMethod, env: EnvMap = process.env): string {
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

export function getAuthMethodHint(provider: ProviderDefinition, method: AuthMethod, env: EnvMap = process.env): string | undefined {
  switch (method) {
    case "api-key":
      return "Paste once and store locally";
    case "env":
      return getEnvMethodHint(getPresentEnvVars(provider, env));
    case "oauth-external":
      return undefined;
    case "none":
      return "Use local or unauthenticated access";
  }
}

export async function confirmExternalOAuthWarning(
  provider: ProviderDefinition,
  promptAdapter: PromptAdapter = defaultPromptAdapter
): Promise<boolean> {
  if (!isCliProxyApiProvider(provider)) return true;
  const accepted = await promptAdapter.confirm({
    message: getCliProxyApiWarning(provider),
    initialValue: false
  });
  if (isCancel(promptAdapter, accepted)) return false;
  return accepted;
}

export async function pickProvider(
  kit: AuthKit,
  message = "Select provider",
  promptAdapter: PromptAdapter = defaultPromptAdapter
): Promise<ProviderDefinition | undefined> {
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
  env: EnvMap = process.env
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
