import { type CliProxyManagementFetch } from "./cliproxyapi-management.js";
import { type ProxyAccountConnector } from "./hosted-types.js";
export declare const CLIPROXY_CALLBACK_PREFIX = "http://localhost:54545/callback";
export type CliProxyAccountProvider = "anthropic";
export interface CliProxyLoginSlot {
    readonly acquire: (key: string, owner: string, ttlMs: number) => Promise<boolean>;
    readonly release: (key: string, owner: string) => Promise<void>;
}
export interface CliProxyAccountConnectorOptions {
    readonly baseUrl: string;
    readonly managementKey: string;
    readonly clientApiKey: string;
    readonly providers?: readonly CliProxyAccountProvider[];
    readonly routePrefix?: (tenantId: string) => string;
    readonly fetch?: CliProxyManagementFetch;
    readonly now?: () => number;
    readonly sessionSecret?: string;
    readonly loginSlot?: CliProxyLoginSlot;
}
export declare function createMemoryLoginSlot(now?: () => number): CliProxyLoginSlot;
export declare function defaultCliProxyRoutePrefix(tenantId: string): string;
export declare function getCliProxyHostedWarning(providerId: string): string;
export declare function createCliProxyAccountConnector(options: CliProxyAccountConnectorOptions): ProxyAccountConnector;
