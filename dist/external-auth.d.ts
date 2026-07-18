import type { ProviderDefinition } from "./types.js";
export declare const CLIPROXYAPI_BASE_URL = "http://localhost:8317";
export type ExternalAuthMetadata = Readonly<Record<string, string>> & {
    readonly adapter: "cliproxyapi";
    readonly provider: "anthropic" | "google";
    readonly baseUrl: typeof CLIPROXYAPI_BASE_URL;
    readonly warningAccepted: "true";
    readonly cliProxyApiPath?: string;
};
export declare function isCliProxyApiProvider(provider: ProviderDefinition | string): boolean;
export declare function isAccountOAuthProvider(provider: ProviderDefinition | string): boolean;
export declare function isExternalOAuthProvider(provider: ProviderDefinition | string): boolean;
export declare function getExternalAuthMetadata(provider: ProviderDefinition | string, options?: {
    readonly cliProxyApiPath?: string;
}): ExternalAuthMetadata | undefined;
export declare function getCliProxyApiLabel(provider: ProviderDefinition): string;
export declare function getCliProxyApiWarning(provider: ProviderDefinition): string;
