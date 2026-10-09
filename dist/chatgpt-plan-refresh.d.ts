import type { AuthFetch, ExternalOAuthCredential, SecretStore } from "./types.js";
export declare const CHATGPT_PLAN_REFRESH_WINDOW_MS: number;
export interface ChatGptPlanRefreshContext {
    readonly key: string;
    readonly credential: ExternalOAuthCredential;
    readonly secrets: SecretStore;
    readonly save: (credential: ExternalOAuthCredential) => Promise<void>;
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
export declare function ensureChatGptPlanAccess(context: ChatGptPlanRefreshContext): Promise<ChatGptPlanAccess>;
