import { type AccountOAuthDeps, type AccountOAuthLoginPrompts, type OpenAiTokenResponse } from "./account-oauth-shared.js";
export declare function loginOpenAiAccountInBrowser(prompts: AccountOAuthLoginPrompts, deps: AccountOAuthDeps): Promise<OpenAiTokenResponse>;
