import type { ModelDefinition } from "./types.js";
export type ConnectionWire = "openai-responses" | "openai-chat" | "anthropic-messages";
export interface PlanUsageConstraints {
    readonly kind: "chatgpt-plan";
    readonly manageUrl: string;
}
export interface ConnectionRuntime {
    readonly providerId: string;
    readonly modelId: string;
    readonly wire: ConnectionWire;
    readonly baseUrl: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly planUsage?: PlanUsageConstraints;
}
export interface ProxyAccountBinding {
    readonly credentialName: string;
    readonly routePrefix: string;
    readonly email?: string;
}
export interface ProxyAccountStart {
    readonly authorizationUrl: string;
    readonly callbackPrefix: string;
    readonly session: string;
    readonly expiresAt: number;
}
export type ProxyAccountProgress = {
    readonly kind: "pending";
} | {
    readonly kind: "connected";
    readonly binding: ProxyAccountBinding;
};
export interface ProxyAccountTarget {
    readonly tenantId: string;
    readonly providerId: string;
}
export interface ProxyAccountSession extends ProxyAccountTarget {
    readonly session: string;
}
export interface ProxyAccountRoute {
    readonly baseUrl: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly model: string;
    readonly wire: ConnectionWire;
}
export type ProxyAccountErrorCode = "account_in_use" | "flow_expired" | "callback_invalid" | "upstream_unavailable";
export declare class ProxyAccountError extends Error {
    readonly code: ProxyAccountErrorCode;
    readonly name = "ProxyAccountError";
    constructor(code: ProxyAccountErrorCode, message: string, options?: ErrorOptions);
}
export interface ProxyAccountConnector {
    readonly providerIds: readonly string[];
    warning(providerId: string): string;
    start(target: ProxyAccountTarget): Promise<ProxyAccountStart>;
    submitCallback(session: ProxyAccountSession, redirectUrl: string): Promise<void>;
    poll(session: ProxyAccountSession): Promise<ProxyAccountProgress>;
    cancel(session: ProxyAccountSession): Promise<void>;
    models(binding: ProxyAccountBinding): Promise<readonly ModelDefinition[]>;
    disconnect(target: ProxyAccountTarget, binding: ProxyAccountBinding): Promise<void>;
    route(binding: ProxyAccountBinding, modelId: string): ProxyAccountRoute;
}
