import type { AuthFetch, ExternalOAuthCredential, SecretStore } from "./types.js";
export declare const CHATGPT_PLAN_REFRESH_WINDOW_MS: number;
export interface ChatGptPlanTokenWrite {
    readonly accessTokenRef: string;
    readonly accessToken: string;
    readonly refreshTokenRef: string;
    readonly refreshToken: string;
}
export type ChatGptPlanLock = <T>(key: string, run: () => Promise<T>) => Promise<T>;
export interface ChatGptPlanRefreshContext {
    readonly key: string;
    readonly credential: ExternalOAuthCredential;
    readonly secrets: SecretStore;
    readonly save: (credential: ExternalOAuthCredential, tokens?: ChatGptPlanTokenWrite) => Promise<void>;
    readonly readCurrent?: () => Promise<ExternalOAuthCredential | undefined>;
    readonly lock?: ChatGptPlanLock;
    readonly fetch?: AuthFetch;
    readonly now?: () => number;
}
export type ChatGptPlanAccess = {
    readonly kind: "ready";
    readonly accessToken: string;
    readonly credential: ExternalOAuthCredential;
} | {
    readonly kind: "reconnect-required";
    readonly credential: ExternalOAuthCredential;
};
export declare function isSameChatGptGeneration(left: ExternalOAuthCredential, right: ExternalOAuthCredential): boolean;
export declare function ensureChatGptPlanAccess(context: ChatGptPlanRefreshContext): Promise<ChatGptPlanAccess>;
