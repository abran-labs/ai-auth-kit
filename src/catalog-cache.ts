import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { NormalizedCatalogSchema, type NormalizedCatalog } from "./catalog-normalize.js";

const CACHE_VERSION = 1;
const CACHE_DIRECTORY = "ai-auth-kit";
const CACHE_FILE = "models-dev-v1.json";
const CacheSchema = z.object({
  version: z.literal(CACHE_VERSION),
  sourceUrl: z.literal("https://models.dev/api.json"),
  etag: z.string().min(1).max(512).nullable(),
  sourceContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fetchedAt: z.iso.datetime(),
  catalog: NormalizedCatalogSchema,
}).readonly().refine((value) => value.sourceContentSha256 === value.catalog.provenance.sourceContentSha256, "Catalog source hash mismatch");

export type CatalogCache = z.output<typeof CacheSchema>;
export type CatalogCacheInput = { readonly catalog: NormalizedCatalog; readonly etag: string | null; readonly fetchedAt: string };

function cacheDir(root: string): string {
  return join(root, CACHE_DIRECTORY);
}

function lockPath(root: string): string {
  return join(cacheDir(root), ".models-dev-v1.lock");
}

export function catalogCachePath(root: string): string {
  return join(cacheDir(root), CACHE_FILE);
}

function isOwnedRegular(stat: Awaited<ReturnType<typeof lstat>>): boolean {
  return stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid?.() && (Number(stat.mode) & 0o777) === 0o600;
}

async function secureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.()) throw new Error("Catalog cache directory is unsafe");
  await chmod(directory, 0o700);
}

async function fsyncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function cleanupTemps(directory: string): Promise<void> {
  for (const entry of await readdir(directory)) {
    if (!entry.startsWith(`.${CACHE_FILE}.`) || !entry.endsWith(".tmp")) continue;
    const path = join(directory, entry);
    const stat = await lstat(path);
    if (isOwnedRegular(stat)) await rm(path);
  }
}

async function quarantine(path: string): Promise<void> {
  try { await rename(path, `${path}.corrupt-${randomUUID()}`); } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

async function acquireLock(root: string): Promise<() => Promise<void>> {
  const path = lockPath(root);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(path, { mode: 0o700 });
      return async () => { await rmdir(path); };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Catalog cache lock is unsafe");
      if (Date.now() - stat.mtimeMs > 30_000) await rmdir(path);
      else await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error("Catalog cache lock timed out");
}

export async function loadCatalogCache(root: string): Promise<CatalogCache | null> {
  const path = catalogCachePath(root);
  try {
    const before = await lstat(path);
    if (!isOwnedRegular(before)) return null;
    const raw = await readFile(path, "utf8");
    const after = await lstat(path);
    if (before.ino !== after.ino || !isOwnedRegular(after)) return null;
    const cached = CacheSchema.parse(JSON.parse(raw));
    if (createHash("sha256").update(JSON.stringify(cached.catalog)).digest("hex") === "") return null;
    return cached;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    await quarantine(path);
    return null;
  }
}

export async function saveCatalogCache(root: string, input: CatalogCacheInput): Promise<void> {
  const directory = cacheDir(root);
  await secureDirectory(directory);
  await cleanupTemps(directory);
  const release = await acquireLock(root);
  const cache = CacheSchema.parse({ version: CACHE_VERSION, sourceUrl: "https://models.dev/api.json", etag: input.etag, sourceContentSha256: input.catalog.provenance.sourceContentSha256, fetchedAt: input.fetchedAt, catalog: input.catalog });
  try {
    const path = catalogCachePath(root);
    const temp = join(directory, `.${CACHE_FILE}.${randomUUID()}.tmp`);
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(cache)}\n`);
      await handle.sync();
    } finally { await handle.close(); }
    try {
      await rename(temp, path);
      await chmod(path, 0o600);
      await fsyncDirectory(directory);
    } finally { await rm(temp, { force: true }); }
  } finally { await release(); }
}
