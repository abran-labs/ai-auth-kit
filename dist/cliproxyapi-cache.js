import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
const TEMP_PREFIX = ".cli-proxy-api-";
const TEMP_MAX_AGE_MS = 60_000;
const SHA256 = /^[a-f0-9]{64}$/;
const metadataSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), archiveDigest: z.string().regex(SHA256), archiveSha256: z.string().regex(SHA256), binarySha256: z.string().regex(SHA256), source: z.literal("github-release") });
function failure(message) { return new Error(`CLIProxyAPI provisioning failed: ${message}`); }
function procPath(fd, child = "") { return `/proc/self/fd/${fd}${child ? `/${child}` : ""}`; }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function uid() { const value = process.getuid?.(); if (value === undefined)
    throw failure("Linux cache ownership is unavailable"); return value; }
function same(left, right) { return SHA256.test(left) && SHA256.test(right) && left === right; }
async function directory(root, parts) {
    if (!root.startsWith("/"))
        throw failure("cache root must be absolute");
    let current = await open("/", fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
    try {
        for (const part of resolve(root).split("/").filter(Boolean)) {
            const child = procPath(current.fd, part);
            try {
                await open(child, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW).then((handle) => handle.close());
            }
            catch (error) {
                if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                    throw error;
                await mkdir(child, { mode: 0o700 });
            }
            const next = await open(child, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
            await current.close();
            current = next;
        }
        const rootStat = await current.stat();
        if (!rootStat.isDirectory() || rootStat.uid !== uid() || (rootStat.mode & 0o077) !== 0)
            throw failure("unsafe cache root");
        for (const part of parts) {
            const child = procPath(current.fd, part);
            try {
                await mkdir(child, { mode: 0o700 });
            }
            catch (error) {
                if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
                    throw error;
            }
            const next = await open(child, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
            const stat = await next.stat();
            if (stat.uid !== uid() || !stat.isDirectory() || (stat.mode & 0o077) !== 0) {
                await next.close();
                throw failure("unsafe cache directory");
            }
            await chmod(child, 0o700);
            await current.close();
            current = next;
        }
        return current;
    }
    catch (error) {
        await current.close();
        throw error;
    }
}
function versionOrder(left, right) {
    const leftParts = left.split(".").map(Number);
    const rightParts = right.split(".").map(Number);
    for (let index = 0; index < 3; index += 1) {
        const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
        if (difference !== 0)
            return difference;
    }
    return 0;
}
async function existingDirectory(parent, name) {
    const handle = await open(procPath(parent, name), fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isDirectory() || stat.uid !== uid() || (stat.mode & 0o077) !== 0) {
        await handle.close();
        throw failure("unsafe cache directory");
    }
    return handle;
}
async function safeRead(dir, name, mode) {
    const path = procPath(dir, name);
    const before = await (await import("node:fs/promises")).lstat(path);
    if (!before.isFile() || before.uid !== uid() || (before.mode & 0o022) !== 0)
        throw failure("unsafe cache target");
    const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
        const after = await handle.stat();
        if (!after.isFile() || after.uid !== uid() || (after.mode & 0o022) !== 0 || after.ino !== before.ino || (after.mode & mode) !== mode)
            throw failure("unsafe cache target");
        return new Uint8Array(await handle.readFile());
    }
    finally {
        await handle.close();
    }
}
async function cleanTemps(dir) {
    for (const name of await readdir(procPath(dir))) {
        if (!name.startsWith(TEMP_PREFIX))
            continue;
        const path = procPath(dir, name);
        const stat = await (await import("node:fs/promises")).lstat(path);
        if (stat.isFile() && stat.uid === uid() && Date.now() - stat.mtimeMs > TEMP_MAX_AGE_MS)
            await rm(path);
    }
}
async function writeFile(dir, name, bytes, mode) {
    const temp = `${TEMP_PREFIX}${randomUUID()}.tmp`;
    const tempPath = procPath(dir, temp);
    const handle = await open(tempPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.chmod(mode);
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    await rename(tempPath, procPath(dir, name));
}
function metadata(version, archiveDigest, binary) {
    return { version, archiveDigest, archiveSha256: archiveDigest, binarySha256: hash(binary), source: "github-release" };
}
async function valid(dir, expected) {
    try {
        const binary = await safeRead(dir, "cli-proxy-api", 0o100);
        const raw = await safeRead(dir, "provenance.json", 0);
        const parsed = metadataSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
        if (!parsed.success || !same(parsed.data.binarySha256, hash(binary)) || !same(parsed.data.archiveDigest, parsed.data.archiveSha256))
            return undefined;
        if (expected && (parsed.data.version !== expected.version || !same(parsed.data.archiveDigest, expected.digest)))
            return undefined;
        return { binary, metadata: parsed.data };
    }
    catch {
        return undefined;
    }
}
export async function writeVerifiedCache(cacheRoot, arch, version, archiveDigest, binary) {
    const root = resolve(cacheRoot, "linux", arch, version, archiveDigest);
    const dir = await directory(cacheRoot, ["linux", arch, version, archiveDigest]);
    try {
        await cleanTemps(dir.fd);
        const existing = await valid(dir.fd, { version, digest: archiveDigest });
        if (existing)
            return { binaryPath: `${root}/cli-proxy-api`, source: "cache" };
        await writeFile(dir.fd, "cli-proxy-api", binary, 0o755);
        await writeFile(dir.fd, "provenance.json", Buffer.from(JSON.stringify(metadata(version, archiveDigest, binary)), "utf8"), 0o600);
        await dir.sync();
        return { binaryPath: `${root}/cli-proxy-api`, source: "download" };
    }
    finally {
        await dir.close();
    }
}
export async function readOfflineCache(cacheRoot, arch) {
    const archDir = await directory(cacheRoot, ["linux", arch]);
    try {
        for (const version of (await readdir(procPath(archDir.fd))).sort(versionOrder)) {
            if (!/^\d+\.\d+\.\d+$/.test(version))
                continue;
            const versionDir = await existingDirectory(archDir.fd, version);
            try {
                for (const digest of await readdir(procPath(versionDir.fd))) {
                    if (!SHA256.test(digest))
                        continue;
                    const leaf = await existingDirectory(versionDir.fd, digest);
                    try {
                        if (await valid(leaf.fd, { version, digest }))
                            return `${resolve(cacheRoot, "linux", arch, version, digest)}/cli-proxy-api`;
                    }
                    finally {
                        await leaf.close();
                    }
                }
            }
            finally {
                await versionDir.close();
            }
        }
        return undefined;
    }
    finally {
        await archDir.close();
    }
}
//# sourceMappingURL=cliproxyapi-cache.js.map