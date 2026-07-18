import { type AccountOAuthDeps, type AccountOAuthLoginPrompts } from "./account-oauth-shared.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";
export declare function loginGitHubCopilotAccount(kit: AuthKit, provider: ProviderDefinition, prompts: AccountOAuthLoginPrompts, deps?: AccountOAuthDeps): Promise<StoredCredential>;
