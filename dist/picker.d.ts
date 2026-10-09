import * as prompts from "@clack/prompts";
import { type AccountOAuthDeps } from "./account-oauth.js";
import { type ChatGptPlanLoginDeps } from "./account-oauth-chatgpt.js";
import type { AuthKit } from "./kit.js";
import type { AuthMethod, ModelDefinition, ProviderDefinition, StoredCredential } from "./types.js";
export { confirmExternalOAuthWarning, getAuthMethodHint, getAuthMethodLabel, getInteractiveAuthMethods, getOAuthComingSoonSubject, getOAuthMethodLabel, getPresentEnvVars, } from "./picker-auth-methods.js";
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
export declare function pickProvider(kit: AuthKit, message?: string, promptAdapter?: PromptAdapter): Promise<ProviderDefinition | undefined>;
export declare function pickModel(kit: AuthKit, providerId: string, message?: string, promptAdapter?: PromptAdapter): Promise<ModelDefinition | undefined>;
export declare function pickAuthMethod(provider: ProviderDefinition, promptAdapter?: PromptAdapter, env?: NodeJS.ProcessEnv): Promise<AuthMethod | undefined>;
export declare function loginWithPrompts(kit: AuthKit, providerId?: string, promptAdapter?: PromptAdapter, options?: LoginWithPromptsOptions): Promise<StoredCredential | undefined>;
