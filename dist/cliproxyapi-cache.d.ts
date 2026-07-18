export interface CacheWriteResult {
    readonly binaryPath: string;
    readonly source: "cache" | "download";
}
export declare function writeVerifiedCache(cacheRoot: string, arch: string, version: string, archiveDigest: string, binary: Uint8Array): Promise<CacheWriteResult>;
export declare function readOfflineCache(cacheRoot: string, arch: string): Promise<string | undefined>;
