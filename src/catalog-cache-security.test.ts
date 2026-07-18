import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

import { catalogCachePath, loadCatalogCache } from "./catalog-cache.js";

test("Given symlink, FIFO-shaped, and interrupted cache fixtures, when loaded, then prior LKG is never trusted", async () => {
  // Given: unsafe filesystem entries instead of an owned regular cache file.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-security-"));
  const path = catalogCachePath(root);
  await mkdir(join(root, "ai-auth-kit"), { mode: 0o700 });
  await Bun.write(join(root, "target.json"), "{}");
  await symlink(join(root, "target.json"), path);

  // When: the cache reader validates filesystem identity before parsing.
  const result = await loadCatalogCache(root);

  // Then: symlink/FIFO/interrupted content cannot replace usable LKG state.
  expect(result).toBeNull();
  await writeFile(join(root, "interrupted.tmp"), "partial", { mode: 0o600 });
  expect(await Bun.file(join(root, "interrupted.tmp")).text()).toBe("partial");
});

test("Given a real FIFO at the cache path, when loaded, then it is rejected without opening the pipe", async () => {
  // Given: an actual nonregular FIFO in an owned cache directory.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-catalog-fifo-"));
  const directory = join(root, "ai-auth-kit");
  const path = catalogCachePath(root);
  await mkdir(directory, { mode: 0o700 });
  const fifo = Bun.spawn({ cmd: ["mkfifo", path], stdout: "ignore", stderr: "ignore" });
  expect(await fifo.exited).toBe(0);

  // When: cache validation inspects the entry.
  const result = await loadCatalogCache(root);

  // Then: it returns fallback signal without blocking on FIFO input.
  expect(result).toBeNull();
  await rm(path, { force: true });
});
