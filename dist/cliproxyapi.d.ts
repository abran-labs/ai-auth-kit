import { type SpawnOptions } from "node:child_process";
import { type CliProxyApiFetch } from "./cliproxyapi-release.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition } from "./types.js";
export declare const CLIPROXYAPI_REPO = "router-for-me/CLIProxyAPI";
export declare const CLIPROXYAPI_LATEST_RELEASE_URL = "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest";
export interface CliProxyApiProvisionResult {
    readonly binaryPath: string;
    readonly source: "path" | "cache" | "download";
    readonly version?: string;
}
export interface CliProxyApiProvisionDeps {
    readonly env?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
    readonly arch?: string;
    readonly fetch?: CliProxyApiFetch;
    readonly fileExists?: (path: string) => Promise<boolean>;
    readonly timeoutMs?: number;
    readonly binaryPath?: string;
}
interface CliProxyApiChildProcess {
    once(event: "error", listener: (error: Error) => void): this;
    once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}
export interface CliProxyApiLoginDeps {
    readonly spawn?: (command: string, args: readonly string[], options: SpawnOptions) => CliProxyApiChildProcess;
}
export interface CliProxyApiLoginResult {
    readonly binaryPath: string;
    readonly args: readonly string[];
}
export declare function runCliProxyApiLogin(binaryPath: string, provider: ProviderDefinition, deps?: CliProxyApiLoginDeps): Promise<CliProxyApiLoginResult>;
export declare function provisionCliProxyApi(cacheDirectory: string, deps?: CliProxyApiProvisionDeps): Promise<CliProxyApiProvisionResult>;
export declare function provisionCliProxyApiForProvider(kit: Pick<AuthKit, "store">, _provider: ProviderDefinition, deps?: CliProxyApiProvisionDeps): Promise<CliProxyApiProvisionResult>;
export {};
