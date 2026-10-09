import { z } from "zod";
import { ChatGptPlanError } from "./chatgpt-plan.js";
import { type ConnectErrorCode, type ConnectMethod, type ConnectModel, type ConnectRequest, type ConnectResponse, type Connection } from "./connect-protocol.js";
import type { PendingFlowStore } from "./hosted-store.js";
import type { ProxyAccountConnector, ProxyAccountError } from "./hosted-types.js";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";
export declare const CONNECT_FLOW_TTL_MS: number;
export declare const CHATGPT_PASTE_INSTRUCTIONS = "Approve access in the browser page that opens. The browser then lands on an address starting with http://127.0.0.1 that fails to load; that failure is expected. Copy the full address from the address bar and paste it here.";
export declare const PROXY_PASTE_INSTRUCTIONS = "Complete the sign-in in the browser page that opens, then paste the full callback address here.";
export declare class ConnectError extends Error {
    readonly code: ConnectErrorCode;
    readonly retryable: boolean;
    readonly name = "ConnectError";
    constructor(code: ConnectErrorCode, message: string, retryable: boolean, options?: ErrorOptions);
}
export declare function connectErrorResponse(code: ConnectErrorCode, message: string, retryable: boolean): ConnectResponse;
export declare function assertNever(value: never): never;
export declare function mapChatGptError(error: ChatGptPlanError): ConnectResponse;
export declare function mapProxyError(error: ProxyAccountError): ConnectResponse;
declare const PendingFlowSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"secret">;
    providerId: z.ZodString;
    expiresAt: z.ZodNumber;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"chatgpt-plan">;
    providerId: z.ZodLiteral<"openai">;
    authorization: z.ZodReadonly<z.ZodObject<{
        state: z.ZodString;
        nonce: z.ZodString;
        codeVerifier: z.ZodString;
        redirectUri: z.ZodString;
        clientId: z.ZodString;
        hostId: z.ZodString;
        expiresAt: z.ZodNumber;
    }, z.core.$strip>>;
    expiresAt: z.ZodNumber;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"proxy-account">;
    providerId: z.ZodString;
    stage: z.ZodEnum<{
        callback: "callback";
        "risk-confirm": "risk-confirm";
    }>;
    session: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodNumber;
}, z.core.$strip>>], "kind">;
export type PendingFlow = z.output<typeof PendingFlowSchema>;
export declare function parsePendingFlow(raw: string): PendingFlow | undefined;
export declare function newFlowId(): string;
export interface HostedMethodOffer {
    readonly method: ConnectMethod;
    readonly flow: PendingFlow["kind"];
}
export type ApiKeyVerdict = "valid" | "invalid" | "unknown";
export interface ConnectFlowContext {
    readonly pendingFlows: PendingFlowStore;
    readonly findProvider: (providerId: string) => ProviderDefinition | undefined;
    readonly hostedMethods: (provider: ProviderDefinition) => readonly HostedMethodOffer[];
    readonly kitFor: (tenantId: string) => AuthKit;
    readonly agentName: string;
    readonly hostId: string;
    readonly callbackPort: number;
    readonly proxyAccounts: ProxyAccountConnector | undefined;
    readonly fetch: AuthFetch | undefined;
    readonly now: () => number;
    readonly validateApiKey: ((providerId: string, key: string) => Promise<ApiKeyVerdict>) | undefined;
    readonly readConnection: (tenantId: string, providerId: string) => Promise<Connection | undefined>;
    readonly modelsFor: (tenantId: string, providerId: string) => Promise<readonly ConnectModel[]>;
    readonly ensureDefaultModel: (tenantId: string, providerId: string) => Promise<void>;
}
export type SubmitInput = Extract<ConnectRequest, {
    op: "submit";
}>["input"];
export declare function flowExpiry(now: number): number;
export declare function isoDate(value: number): string;
export declare function loadPending(context: ConnectFlowContext, tenantId: string, flowId: string, remove: boolean): Promise<PendingFlow>;
export declare function connectedStep(context: ConnectFlowContext, tenantId: string, providerId: string): Promise<ConnectResponse>;
export {};
