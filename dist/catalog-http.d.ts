export type CatalogHttpResult = {
    readonly kind: "fresh";
    readonly body: string;
    readonly etag: string | null;
} | {
    readonly kind: "not-modified";
};
export type CatalogFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type CatalogHttpOptions = {
    readonly fetch: CatalogFetch;
    readonly url: string;
    readonly etag: string | null;
    readonly timeoutMs?: number;
    readonly maxBytes?: number;
    readonly retries?: number;
};
export declare function fetchModelsDevCatalog(options: CatalogHttpOptions): Promise<CatalogHttpResult>;
