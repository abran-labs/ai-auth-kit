import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

import { createCatalogRefresher } from "./catalog-refresh.js";
import { SNAPSHOT_CATALOG } from "../generated/catalog-snapshot.js";

const SOURCE = { provider: { id: "provider", name: "Provider", env: ["PROVIDER_API_KEY"], models: { "new-model": { id: "new-model", name: "New Model" } } } };

test("Given source A then B, when refreshes new model and restarts offline, then LKG B survives", async () => {
  // Given: a local source that changes once and an isolated cache root.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-"));
  let online = true;
  const fetch = async (): Promise<Response> => {
    if (!online) throw new TypeError("offline");
    return new Response(JSON.stringify(SOURCE), { headers: { etag: '"B"' } });
  };
  const first = createCatalogRefresher({ cacheRoot: root, fetch, sourceSchemaCommit: "800bbc1253753b9ac6675e9b2a123877c3dc5b80", snapshot: SNAPSHOT_CATALOG });

  // When: a new model is fetched then the process restarts offline.
  const refreshed = await first.refresh();
  online = false;
  const restarted = createCatalogRefresher({ cacheRoot: root, fetch, sourceSchemaCommit: "800bbc1253753b9ac6675e9b2a123877c3dc5b80", snapshot: SNAPSHOT_CATALOG });
  const fallback = await restarted.refresh();

  // Then: refresh exposes B and offline restart returns the last-known-good B.
  expect(refreshed.catalog.providers[0]?.models[0]?.id).toBe("new-model");
  expect(fallback.source).toBe("cache");
  expect(fallback.catalog).toEqual(refreshed.catalog);
});

test("Given offline startup, when offline snapshot fallback refreshes and timer disposes, then snapshot works", async () => {
  // Given: no cache and an unavailable local transport.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-"));
  const fetch = async (): Promise<Response> => { throw new TypeError("offline"); };
  const refresher = createCatalogRefresher({ cacheRoot: root, fetch, sourceSchemaCommit: "800bbc1253753b9ac6675e9b2a123877c3dc5b80", snapshot: SNAPSHOT_CATALOG });

  // When: fallback and lifecycle timer are used.
  const result = await refresher.refresh();
  const timer = refresher.startHourlyRefresh();
  timer.dispose();

  // Then: offline source is deterministic snapshot and disposal is safe.
  expect(result.source).toBe("snapshot");
  expect(result.catalog).toEqual(SNAPSHOT_CATALOG);
});
