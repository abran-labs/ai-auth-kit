import { z } from "zod";
import { type ChatGptIdentity } from "./chatgpt-plan-id-token.js";
import type { AuthFetch } from "./types.js";
export { CHATGPT_ISSUER, ChatGptPlanError, type ChatGptIdentity, type ChatGptPlanErrorCode } from "./chatgpt-plan-id-token.js";
export { planNotGrantedCause, type ChatGptPlanNotGrantedCause } from "./chatgpt-plan-scope.js";
export declare const CHATGPT_AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
export declare const CHATGPT_TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
export declare const CHATGPT_REVOKE_URL = "https://auth.openai.com/api/accounts/oauth/revoke";
export declare const CHATGPT_PLAN_RESOURCE = "https://api.openai.com/v1";
export declare const CHATGPT_PLAN_SCOPE = "chatgpt.tokens.use.direct";
export declare const CHATGPT_PLAN_SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export declare const CHATGPT_DYNAMIC_CLIENT_ID = "dynamic_agent_client";
export declare const CHATGPT_CALLBACK_PATH = "/auth/callback";
export declare const CHATGPT_DEFAULT_CALLBACK_PORT = 1455;
export declare const ChatGptPendingAuthorizationSchema: z.ZodReadonly<z.ZodObject<{
    state: z.ZodString;
    nonce: z.ZodString;
    codeVerifier: z.ZodString;
    redirectUri: z.ZodString;
    clientId: z.ZodString;
    hostId: z.ZodString;
    expiresAt: z.ZodNumber;
}, z.core.$strip>>;
export type ChatGptPendingAuthorization = z.output<typeof ChatGptPendingAuthorizationSchema>;
export interface ChatGptAuthorizationRequest {
    readonly agentName: string;
    readonly hostId: string;
    readonly clientId?: string;
    readonly idTokenHint?: string;
    readonly port?: number;
    readonly loginHint?: string;
    readonly now?: number;
}
export interface ChatGptAuthorization {
    readonly authorizationUrl: string;
    readonly pending: ChatGptPendingAuthorization;
}
export interface ChatGptCallbackResult {
    readonly code: string;
    readonly clientId: string;
}
export interface ChatGptPlanTokens {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: number;
    readonly scopes: readonly string[];
    readonly clientId: string;
}
export interface ChatGptSignIn extends ChatGptPlanTokens {
    readonly identity: ChatGptIdentity;
    readonly idToken: string;
}
export interface ChatGptExchangeInput {
    readonly code: string;
    readonly clientId: string;
    readonly pending: ChatGptPendingAuthorization;
    readonly fetch?: AuthFetch;
    readonly now?: number;
}
export interface ChatGptRefreshInput {
    readonly clientId: string;
    readonly refreshToken: string;
    readonly fetch?: AuthFetch;
    readonly now?: number;
}
export declare function createChatGptHostId(): string;
export declare function isChatGptHostId(value: string): boolean;
export declare function chatGptRedirectUri(port?: number): string;
export declare function startChatGptAuthorization(request: ChatGptAuthorizationRequest): ChatGptAuthorization;
export declare function parseChatGptCallback(input: string, pending: ChatGptPendingAuthorization, now?: number): ChatGptCallbackResult;
export declare function exchangeChatGptCode(input: ChatGptExchangeInput): Promise<ChatGptSignIn>;
export declare function refreshChatGptTokens(input: ChatGptRefreshInput): Promise<ChatGptPlanTokens>;
export declare function revokeChatGptSession(input: Omit<ChatGptRefreshInput, "now">): Promise<boolean>;
