import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";
export declare const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export declare const OPENAI_ISSUER = "https://auth.openai.com";
export declare const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export declare const OPENAI_OAUTH_SCOPES: string;
export declare const GITHUB_COPILOT_CLIENT_ID = "Ov23li8tweQw6odWQebz";
export declare const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
export declare const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
export declare const GITHUB_COPILOT_API_BASE_URL = "https://api.githubcopilot.com";
export interface AccountOAuthDeps {
    readonly fetch?: typeof fetch;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly now?: () => number;
    readonly openUrl?: (url: string) => Promise<boolean>;
    readonly openAiLoopbackTimeoutMs?: number;
    readonly openAiLoopbackPorts?: readonly number[];
}
export interface AccountOAuthLoginPrompts {
    info(message: string): void;
}
export interface OpenAiCodexRefreshToken {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresInSeconds: number;
    readonly accountId?: string;
}
export interface OpenAiTokenResponse {
    readonly access_token: string;
    readonly refresh_token: string;
    readonly id_token?: string;
    readonly expires_in?: number;
}
export type AccountLogin = (kit: AuthKit, provider: ProviderDefinition, prompts: AccountOAuthLoginPrompts, deps?: AccountOAuthDeps) => Promise<StoredCredential>;
export declare function requireFetch(deps: AccountOAuthDeps): typeof fetch;
export declare function readJson<T>(response: Response, label: string): Promise<T>;
export declare function sleep(deps: AccountOAuthDeps, milliseconds: number): Promise<void>;
export declare function now(deps: AccountOAuthDeps): number;
export declare function secretRef(providerId: string, name: string): string;
export declare function randomUrlSafeText(byteLength: number): string;
export declare function buildCodeChallenge(codeVerifier: string): string;
export declare function extractOpenAiAccountId(idToken: string | undefined): string | undefined;
