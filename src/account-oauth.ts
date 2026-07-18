import { loginGitHubCopilotAccount } from "./account-oauth-github.js";
import { loginOpenAiAccount, refreshOpenAiCodexToken } from "./account-oauth-openai.js";
import type { AccountOAuthDeps, AccountOAuthLoginPrompts } from "./account-oauth-shared.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";

export type { AccountOAuthDeps, AccountOAuthLoginPrompts, OpenAiCodexRefreshToken } from "./account-oauth-shared.js";
export { loginGitHubCopilotAccount, loginOpenAiAccount, refreshOpenAiCodexToken };

export async function loginAccountOAuthProvider(
  kit: AuthKit,
  provider: ProviderDefinition,
  prompts: AccountOAuthLoginPrompts,
  deps: AccountOAuthDeps = {},
): Promise<StoredCredential | undefined> {
  switch (provider.id) {
    case "openai": return loginOpenAiAccount(kit, provider, prompts, deps);
    case "github-copilot": return loginGitHubCopilotAccount(kit, provider, prompts, deps);
    default: return undefined;
  }
}
