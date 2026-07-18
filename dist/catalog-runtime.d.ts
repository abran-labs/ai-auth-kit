import { type CatalogFetch } from "./catalog-http.js";
import type { ProviderDefinition } from "./types.js";
export type CatalogRuntimeOptions = {
    readonly cacheRoot?: string;
    readonly fetch?: CatalogFetch;
    readonly now?: () => number;
};
export type CatalogStatus = {
    readonly source: "network" | "cache" | "snapshot";
    readonly etag: string | null;
    readonly fetchedAt: string | null;
    readonly sourceContentSha256: string;
};
export type CatalogRefreshOptions = {
    readonly force?: boolean;
};
export declare class CatalogRuntime {
    private readonly refresher;
    private providers;
    private status;
    private timer;
    constructor(options?: CatalogRuntimeOptions);
    listProviders(): readonly ProviderDefinition[];
    catalogStatus(): CatalogStatus;
    refresh(force?: boolean): Promise<CatalogStatus>;
    startHourlyRefresh(): void;
    dispose(): void;
    private update;
    private statusFrom;
}
