import { ChatGptPlanError, type ChatGptPendingAuthorization } from "./chatgpt-plan.js";
export type ChatGptCallbackOutcome = {
    readonly ok: true;
    readonly code: string;
    readonly clientId: string;
} | {
    readonly ok: false;
    readonly error: ChatGptPlanError;
};
export interface ChatGptLoopback {
    readonly port: number;
    readonly redirectUri: string;
    waitForCallback(): Promise<ChatGptCallbackOutcome>;
    close(): Promise<void>;
}
export declare function startChatGptLoopback(ports: readonly number[], pendingFor: () => ChatGptPendingAuthorization | undefined): Promise<ChatGptLoopback>;
