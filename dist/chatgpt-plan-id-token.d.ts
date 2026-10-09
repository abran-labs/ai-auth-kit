import type { AuthFetch } from "./types.js";
export declare const CHATGPT_ISSUER = "https://auth.openai.com";
export declare const CHATGPT_JWKS_URL = "https://auth.openai.com/.well-known/jwks.json";
export type ChatGptPlanErrorCode = "callback_invalid" | "access_denied" | "plan_not_granted" | "id_token_invalid" | "identity_mismatch" | "invalid_client" | "reconnect_required" | "upstream_unavailable";
export declare class ChatGptPlanError extends Error {
    readonly code: ChatGptPlanErrorCode;
    readonly name = "ChatGptPlanError";
    constructor(code: ChatGptPlanErrorCode, message: string, options?: ErrorOptions);
}
export interface ChatGptIdentity {
    readonly subject: string;
    readonly email?: string;
    readonly name?: string;
}
export interface ChatGptIdTokenCheck {
    readonly clientId: string;
    readonly nonce: string;
    readonly fetch: AuthFetch;
    readonly now: number;
}
export declare function verifyChatGptIdToken(token: string, check: ChatGptIdTokenCheck): Promise<ChatGptIdentity>;
export declare function resetChatGptSigningKeysForTests(): void;
