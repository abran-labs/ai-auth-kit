import { type CatalogFetch } from "./catalog-http.js";
import { type NormalizedCatalog } from "./catalog-normalize.js";
export type CatalogRefreshResult = {
    readonly source: "network" | "cache" | "snapshot";
    readonly catalog: NormalizedCatalog;
};
export type CatalogRefresherOptions = {
    readonly cacheRoot?: string;
    readonly fetch?: CatalogFetch;
    readonly sourceSchemaCommit: string;
    readonly snapshot: NormalizedCatalog;
    readonly now?: () => number;
};
export type CatalogRefreshTimer = {
    readonly dispose: () => void;
};
export declare function createCatalogRefresher(options: CatalogRefresherOptions): {
    readonly refresh: (force?: boolean) => Promise<CatalogRefreshResult>;
    readonly startHourlyRefresh: () => CatalogRefreshTimer;
};
