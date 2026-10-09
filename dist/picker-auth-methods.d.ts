import * as prompts from "@clack/prompts";
import type { AuthMethod, ProviderDefinition } from "./types.js";
export type EnvMap = NodeJS.ProcessEnv;
export interface ConfirmPromptAdapter {
    readonly isCancel: typeof prompts.isCancel;
    readonly confirm: typeof prompts.confirm;
}
export declare function getOAuthMethodLabel(provider: ProviderDefinition): string;
export declare function getOAuthComingSoonSubject(provider: ProviderDefinition): string;
export declare function getPresentEnvVars(provider: ProviderDefinition, env?: EnvMap): string[];
export declare function getInteractiveAuthMethods(provider: ProviderDefinition, env?: EnvMap): AuthMethod[];
export declare function getAuthMethodLabel(provider: ProviderDefinition, method: AuthMethod, env?: EnvMap): string;
export declare function getAuthMethodHint(provider: ProviderDefinition, method: AuthMethod, env?: EnvMap): string | undefined;
export declare function confirmExternalOAuthWarning(provider: ProviderDefinition, promptAdapter: ConfirmPromptAdapter): Promise<boolean>;
