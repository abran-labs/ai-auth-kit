import { chmod, mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

import { catalogCachePath, loadCatalogCache, saveCatalogCache } from "./catalog-cache.js";
import { normalizeModelsDevCatalog } from "./catalog-normalize.js";

const SOURCE = { provider: { id: "provider", name: "Provider", env: ["PROVIDER_API_KEY"], models: { model: { id: "model", name: "Model" } } } };
const PROVENANCE = { sourceUrl: "https://models.dev/api.json", sourceSchemaCommit: "800bbc1253753b9ac6675e9b2a123877c3dc5b80", capturedAt: "2026-07-17T17:12:31-04:00", etag: null, sourceContentSha256: "e38484e40478b751cf89099c336ef05fcab66d4313cf47865d639855c6f277ec" };
const CATALOG = normalizeModelsDevCatalog(SOURCE, PROVENANCE);

test("Given a valid catalog, when cache is saved and loaded, then metadata and catalog round-trip privately", async () => {
  // Given: an isolated XDG cache root.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-"));
  const path = catalogCachePath(root);

  // When: valid last-known-good state is persisted.
  await saveCatalogCache(root, { catalog: CATALOG, etag: '"A"', fetchedAt: "2026-07-17T18:00:00.000Z" });
  const loaded = await loadCatalogCache(root);

  // Then: a valid record returns and private JSON persists.
  expect(loaded?.catalog).toEqual(CATALOG);
  expect(loaded?.etag).toBe('"A"');
  expect((await Bun.file(path).stat()).mode & 0o777).toBe(0o600);
});

test("Given corrupt, old-schema, or symlink cache state, when loaded, then it is quarantined and ignored", async () => {
  // Given: malformed and unsafe cache candidates.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-"));
  const path = catalogCachePath(root);
  await Bun.write(path, "{not-json");

  // When: corrupt state is read.
  const corrupt = await loadCatalogCache(root);

  // Then: it cannot become catalog authority.
  expect(corrupt).toBeNull();
  await writeFile(path, "{}", { mode: 0o600 });
  expect(await loadCatalogCache(root)).toBeNull();
  await writeFile(join(root, "target.json"), await readFile(path));
  await rm(path, { force: true });
  await symlink(join(root, "target.json"), path);
  expect(await loadCatalogCache(root)).toBeNull();
});

test("Given an unsafe mode or stale lock, when cache is read or written, then unsafe state is ignored and lock recovers", async () => {
  // Given: a cache record whose permissions have drifted and a stale writer lock.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-"));
  await saveCatalogCache(root, { catalog: CATALOG, etag: null, fetchedAt: "2026-07-17T18:00:00.000Z" });
  const path = catalogCachePath(root);
  await chmod(path, 0o644);
  const lock = join(root, "ai-auth-kit", ".models-dev-v1.lock");
  await mkdir(lock, { mode: 0o700 });
  await utimes(lock, 0, 0);

  // When: reader and next writer encounter the hostile state.
  const unsafe = await loadCatalogCache(root);
  await chmod(path, 0o600);
  await saveCatalogCache(root, { catalog: CATALOG, etag: '"B"', fetchedAt: "2026-07-17T18:01:00.000Z" });

  // Then: insecure cache cannot be consumed and a new atomic writer restores LKG.
  expect(unsafe).toBeNull();
  expect((await loadCatalogCache(root))?.etag).toBe('"B"');
});
