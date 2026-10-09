export type CliProxyManagementFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type CliProxyManagementErrorCode = "bad_request" | "unauthorized" | "not_found" | "conflict" | "upstream_unavailable" | "invalid_response";
export declare class CliProxyManagementError extends Error {
    readonly code: CliProxyManagementErrorCode;
    readonly status?: number | undefined;
    readonly name = "CliProxyManagementError";
    constructor(code: CliProxyManagementErrorCode, message: string, status?: number | undefined, options?: ErrorOptions);
}
export interface CliProxyManagementOptions {
    readonly baseUrl: string;
    readonly managementKey: string;
    readonly fetch?: CliProxyManagementFetch;
    readonly timeoutMs?: number;
}
export interface CliProxyAuthUrl {
    readonly url: string;
    readonly state: string;
}
export type CliProxyOAuthStatus = "wait" | "ok" | "error";
export interface CliProxyOAuthStatusResult {
    readonly status: CliProxyOAuthStatus;
    readonly error?: string;
}
export interface CliProxyCredentialFile {
    readonly id: string;
    readonly authIndex: string;
    readonly name: string;
    readonly type: string;
    readonly provider: string;
    readonly label: string;
    readonly status: string;
    readonly statusMessage?: string;
    readonly disabled: boolean;
    readonly unavailable?: boolean;
    readonly email?: string;
}
export interface CliProxyCredentialModel {
    readonly id: string;
    readonly displayName?: string;
    readonly type?: string;
    readonly ownedBy?: string;
}
export interface CliProxyManagementClient {
    readonly requestAuthUrl: (provider: string) => Promise<CliProxyAuthUrl>;
    readonly submitCallbackRedirect: (provider: string, redirectUrl: string) => Promise<void>;
    readonly oauthStatus: (state: string) => Promise<CliProxyOAuthStatusResult>;
    readonly cancelSession: (state: string) => Promise<boolean>;
    readonly listCredentials: () => Promise<readonly CliProxyCredentialFile[]>;
    readonly deleteCredential: (name: string) => Promise<void>;
    readonly patchCredentialPrefix: (name: string, prefix: string) => Promise<void>;
    readonly credentialModels: (name: string) => Promise<readonly CliProxyCredentialModel[]>;
}
export declare function createCliProxyManagementClient(options: CliProxyManagementOptions): CliProxyManagementClient;
