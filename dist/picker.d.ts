import * as prompts from "@clack/prompts";
import { type AccountOAuthDeps } from "./account-oauth.js";
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
export declare function getOAuthMethodLabel(provider: ProviderDefinition): string;
export declare function getOAuthComingSoonSubject(provider: ProviderDefinition): string;
export declare function getPresentEnvVars(provider: ProviderDefinition, env?: EnvMap): string[];
export declare function getInteractiveAuthMethods(provider: ProviderDefinition, env?: EnvMap): AuthMethod[];
export declare function getAuthMethodLabel(provider: ProviderDefinition, method: AuthMethod, env?: EnvMap): string;
export declare function getAuthMethodHint(provider: ProviderDefinition, method: AuthMethod, env?: EnvMap): string | undefined;
export declare function confirmExternalOAuthWarning(provider: ProviderDefinition, promptAdapter?: PromptAdapter): Promise<boolean>;
export declare function pickProvider(kit: AuthKit, message?: string, promptAdapter?: PromptAdapter): Promise<ProviderDefinition | undefined>;
export declare function pickModel(kit: AuthKit, providerId: string, message?: string, promptAdapter?: PromptAdapter): Promise<ModelDefinition | undefined>;
export declare function pickAuthMethod(provider: ProviderDefinition, promptAdapter?: PromptAdapter, env?: EnvMap): Promise<AuthMethod | undefined>;
export declare function loginWithPrompts(kit: AuthKit, providerId?: string, promptAdapter?: PromptAdapter, options?: LoginWithPromptsOptions): Promise<StoredCredential | undefined>;
export {};
