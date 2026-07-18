import { providersFromCatalog } from "./catalog-adapter.js";
import {} from "./catalog-http.js";
import { createCatalogRefresher } from "./catalog-refresh.js";
import { SNAPSHOT_CATALOG } from "./catalog-snapshot.js";
const SOURCE_SCHEMA_COMMIT = "800bbc1253753b9ac6675e9b2a123877c3dc5b80";
export class CatalogRuntime {
    refresher;
    providers;
    status;
    timer;
    constructor(options = {}) {
        this.refresher = createCatalogRefresher({ ...options, sourceSchemaCommit: SOURCE_SCHEMA_COMMIT, snapshot: SNAPSHOT_CATALOG });
        this.providers = providersFromCatalog(SNAPSHOT_CATALOG);
        this.status = this.statusFrom("snapshot", SNAPSHOT_CATALOG);
    }
    listProviders() {
        return this.providers;
    }
    catalogStatus() {
        return this.status;
    }
    async refresh(force = false) {
        const refreshed = await this.refresher.refresh(force);
        this.update(refreshed);
        return this.status;
    }
    startHourlyRefresh() {
        if (this.timer === undefined)
            this.timer = this.refresher.startHourlyRefresh();
    }
    dispose() {
        this.timer?.dispose();
        this.timer = undefined;
    }
    update(result) {
        this.providers = providersFromCatalog(result.catalog);
        this.status = this.statusFrom(result.source, result.catalog);
    }
    statusFrom(source, catalog) {
        return {
            source,
            etag: catalog.provenance.etag,
            fetchedAt: source === "snapshot" ? null : catalog.provenance.capturedAt,
            sourceContentSha256: catalog.provenance.sourceContentSha256,
        };
    }
}
//# sourceMappingURL=catalog-runtime.js.map