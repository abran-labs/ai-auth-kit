import { type AccountOAuthDeps, type AccountOAuthLoginPrompts, type OpenAiCodexRefreshToken } from "./account-oauth-shared.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";
export declare function refreshOpenAiCodexToken(refreshToken: string): Promise<OpenAiCodexRefreshToken>;
export declare function loginOpenAiAccount(kit: AuthKit, provider: ProviderDefinition, prompts: AccountOAuthLoginPrompts, deps?: AccountOAuthDeps): Promise<StoredCredential>;
