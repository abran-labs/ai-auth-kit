import { providersFromCatalog } from "./catalog-adapter.js";
import { type CatalogFetch } from "./catalog-http.js";
import { createCatalogRefresher, type CatalogRefreshResult, type CatalogRefreshTimer } from "./catalog-refresh.js";
import { SNAPSHOT_CATALOG } from "./catalog-snapshot.js";
import type { ProviderDefinition } from "./types.js";

const SOURCE_SCHEMA_COMMIT = "800bbc1253753b9ac6675e9b2a123877c3dc5b80";

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

export type CatalogRefreshOptions = { readonly force?: boolean };

export class CatalogRuntime {
  private readonly refresher;
  private providers: readonly ProviderDefinition[];
  private status: CatalogStatus;
  private timer: CatalogRefreshTimer | undefined;

  constructor(options: CatalogRuntimeOptions = {}) {
    this.refresher = createCatalogRefresher({ ...options, sourceSchemaCommit: SOURCE_SCHEMA_COMMIT, snapshot: SNAPSHOT_CATALOG });
    this.providers = providersFromCatalog(SNAPSHOT_CATALOG);
    this.status = this.statusFrom("snapshot", SNAPSHOT_CATALOG);
  }

  listProviders(): readonly ProviderDefinition[] {
    return this.providers;
  }

  catalogStatus(): CatalogStatus {
    return this.status;
  }

  async refresh(force = false): Promise<CatalogStatus> {
    const refreshed = await this.refresher.refresh(force);
    this.update(refreshed);
    return this.status;
  }

  startHourlyRefresh(): void {
    if (this.timer === undefined) this.timer = this.refresher.startHourlyRefresh();
  }

  dispose(): void {
    this.timer?.dispose();
    this.timer = undefined;
  }

  private update(result: CatalogRefreshResult): void {
    this.providers = providersFromCatalog(result.catalog);
    this.status = this.statusFrom(result.source, result.catalog);
  }

  private statusFrom(source: CatalogStatus["source"], catalog: CatalogRefreshResult["catalog"]): CatalogStatus {
    return {
      source,
      etag: catalog.provenance.etag,
      fetchedAt: source === "snapshot" ? null : catalog.provenance.capturedAt,
      sourceContentSha256: catalog.provenance.sourceContentSha256,
    };
  }
}
