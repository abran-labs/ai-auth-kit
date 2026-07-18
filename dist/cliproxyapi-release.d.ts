import { type CliProxyApiFetch, type TransportOptions } from "./cliproxyapi-http.js";
export type { CliProxyApiFetch } from "./cliproxyapi-http.js";
export interface VerifiedRelease {
    readonly version: string;
    readonly archive: Uint8Array;
    readonly archiveDigest: string;
}
export interface ReleaseTarget {
    readonly assetArch: string;
}
export declare function getReleaseTarget(platform: NodeJS.Platform, value: string): ReleaseTarget;
export declare function requireLinuxTarget(platform: NodeJS.Platform, value: string): void;
export declare function downloadVerifiedRelease(fetch: CliProxyApiFetch, latestUrl: string, platform: NodeJS.Platform, value: string, options?: TransportOptions): Promise<VerifiedRelease>;
