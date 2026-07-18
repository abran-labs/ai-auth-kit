import { homedir } from "node:os";
import { join } from "node:path";
import { loadCatalogCache, saveCatalogCache } from "./catalog-cache.js";
import { fetchModelsDevCatalog } from "./catalog-http.js";
import { normalizeModelsDevCatalog } from "./catalog-normalize.js";
const MODELS_DEV_URL = "https://models.dev/api.json";
const REFRESH_GUARD_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
function defaultCacheRoot() {
    return process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
}
export function createCatalogRefresher(options) {
    const root = options.cacheRoot ?? defaultCacheRoot();
    const fetch = options.fetch ?? globalThis.fetch;
    const now = options.now ?? Date.now;
    let lastAttempt = 0;
    let inFlight;
    const fallback = async () => {
        const cached = await loadCatalogCache(root);
        return cached === null ? { source: "snapshot", catalog: options.snapshot } : { source: "cache", catalog: cached.catalog };
    };
    const refresh = async (force = false) => {
        if (inFlight !== undefined)
            return inFlight;
        if (!force && now() - lastAttempt < REFRESH_GUARD_MS)
            return fallback();
        lastAttempt = now();
        inFlight = (async () => {
            const existing = await loadCatalogCache(root);
            try {
                const response = await fetchModelsDevCatalog({ fetch, url: MODELS_DEV_URL, etag: existing?.etag ?? null });
                if (response.kind === "not-modified" && existing !== null)
                    return { source: "cache", catalog: existing.catalog };
                if (response.kind === "not-modified")
                    return fallback();
                const contentSha = new Bun.CryptoHasher("sha256").update(response.body).digest("hex");
                const catalog = normalizeModelsDevCatalog(JSON.parse(response.body), { sourceUrl: MODELS_DEV_URL, sourceSchemaCommit: options.sourceSchemaCommit, capturedAt: new Date(now()).toISOString(), etag: response.etag, sourceContentSha256: contentSha });
                await saveCatalogCache(root, { catalog, etag: response.etag, fetchedAt: new Date(now()).toISOString() });
                return { source: "network", catalog };
            }
            catch {
                return fallback();
            }
        })();
        try {
            return await inFlight;
        }
        finally {
            inFlight = undefined;
        }
    };
    return {
        refresh,
        startHourlyRefresh: () => {
            const timer = setInterval(() => { void refresh(); }, HOUR_MS);
            return { dispose: () => clearInterval(timer) };
        },
    };
}
//# sourceMappingURL=catalog-refresh.js.map