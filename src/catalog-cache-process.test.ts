import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

import { catalogCachePath, loadCatalogCache, saveCatalogCache } from "./catalog-cache.js";
import { SNAPSHOT_CATALOG } from "../generated/catalog-snapshot.js";

function writer(root: string, etag: string): ReturnType<typeof Bun.spawn> {
  return Bun.spawn({
    cmd: [process.execPath, "--bun", "-e", `
      import { saveCatalogCache } from ${JSON.stringify(`${process.cwd()}/src/catalog-cache.ts`)};
      import { SNAPSHOT_CATALOG } from ${JSON.stringify(`${process.cwd()}/generated/catalog-snapshot.ts`)};
      await saveCatalogCache(${JSON.stringify(root)}, { catalog: SNAPSHOT_CATALOG, etag: ${JSON.stringify(etag)}, fetchedAt: "2026-07-17T18:00:00.000Z" });
    `],
    stdout: "ignore",
    stderr: "pipe",
  });
}

test("Given concurrent processes, when both atomically save a catalog, then the shared cache remains parseable", async () => {
  // Given: two independent Bun processes targeting one cache root.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-process-"));
  try {
    const first = writer(root, '"A"');
    const second = writer(root, '"B"');

    // When: both writers complete through the cache lock protocol.
    const results = await Promise.all([first.exited, second.exited]);

    // Then: each succeeds and one complete LKG record wins.
    expect(results).toEqual([0, 0]);
    expect((await loadCatalogCache(root))?.etag).toMatch(/^"[AB]"$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Given a SIGKILL orphan lock and temp, when the next writer saves, then stale state is recovered", async () => {
  // Given: a process-created lock that is terminated before cleanup plus an abandoned temp.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-kill-"));
  const directory = join(root, "ai-auth-kit");
  try {
    await mkdir(directory, { mode: 0o700 });
    const lock = join(directory, ".models-dev-v1.lock");
    const child = Bun.spawn({ cmd: ["sh", "-c", `mkdir ${JSON.stringify(lock)} && kill -STOP $$`], stdout: "ignore", stderr: "ignore" });
    await Bun.sleep(50);
    child.kill("SIGKILL");
    await child.exited;
    await utimes(lock, 0, 0);
    const temp = join(directory, ".models-dev-v1.json.interrupted.tmp");
    await writeFile(temp, "partial", { mode: 0o600 });

    // When: a later process saves the known-good snapshot.
    await saveCatalogCache(root, { catalog: SNAPSHOT_CATALOG, etag: '"recovered"', fetchedAt: "2026-07-17T18:00:00.000Z" });

    // Then: stale lock/temp vanish and valid cache replaces neither source nor LKG atomically.
    expect((await loadCatalogCache(root))?.etag).toBe('"recovered"');
    expect(await Bun.file(temp).exists()).toBe(false);
    expect(await Bun.file(catalogCachePath(root)).exists()).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
