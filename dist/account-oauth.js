import { loginGitHubCopilotAccount } from "./account-oauth-github.js";
import { loginOpenAiAccount, refreshOpenAiCodexToken } from "./account-oauth-openai.js";
export { loginGitHubCopilotAccount, loginOpenAiAccount, refreshOpenAiCodexToken };
export async function loginAccountOAuthProvider(kit, provider, prompts, deps = {}) {
    switch (provider.id) {
        case "openai": return loginOpenAiAccount(kit, provider, prompts, deps);
        case "github-copilot": return loginGitHubCopilotAccount(kit, provider, prompts, deps);
        default: return undefined;
    }
}
//# sourceMappingURL=account-oauth.js.map