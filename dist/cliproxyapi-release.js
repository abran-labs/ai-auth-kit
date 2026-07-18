import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedRequest } from "./cliproxyapi-http.js";
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_CHECKSUM_BYTES = 1024 * 1024;
const MAX_RELEASE_BYTES = 2 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const assetSchema = z.object({ name: z.string().min(1), browser_download_url: z.url(), digest: z.string(), size: z.number().int(), state: z.string() });
const releaseSchema = z.object({ tag_name: z.string().regex(/^v?\d+\.\d+\.\d+$/), draft: z.literal(false), prerelease: z.literal(false), assets: z.array(assetSchema) });
function failure(message) { return new Error(`CLIProxyAPI provisioning failed: ${message}`); }
function hash(data) { return createHash("sha256").update(data).digest("hex"); }
function same(left, right) { return SHA256.test(left) && SHA256.test(right) && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex")); }
function digest(value, name) { const match = /^sha256:([a-f0-9]{64})$/.exec(value); if (!match?.[1])
    throw failure(`${name} digest must be sha256:<hex>`); return match[1]; }
function asset(value, tag) {
    if (value.state !== "uploaded" || value.size <= 0)
        throw failure(`release asset ${value.name} is invalid`);
    const expected = `https://github.com/router-for-me/CLIProxyAPI/releases/download/${tag}/${value.name}`;
    if (value.browser_download_url !== expected)
        throw failure(`release asset ${value.name} has unsafe URL`);
    return { name: value.name, url: value.browser_download_url, digest: digest(value.digest, value.name), size: value.size };
}
function one(assets, name) { const matches = assets.filter((item) => item.name === name); if (matches.length !== 1)
    throw failure(`release must contain exactly one ${name} asset`); const found = matches[0]; if (!found)
    throw failure(`release asset ${name} is missing`); return found; }
function arch(platform, value) { if (platform !== "linux" || (value !== "x64" && value !== "arm64"))
    throw failure(`auto-provisioning is unsupported on ${platform}/${value}`); return value === "x64" ? "amd64" : "aarch64"; }
function checksum(bytes, name) { const lines = new TextDecoder("utf-8", { fatal: true }).decode(bytes).split(/\r?\n/); const matches = lines.flatMap((line) => { const match = /^([a-f0-9]{64})  (.+)$/.exec(line); return match?.[2] === name && match[1] ? [match[1]] : []; }); if (matches.length !== 1)
    throw failure(`checksums.txt must contain exactly one valid checksum for ${name}`); const found = matches[0]; if (!found)
    throw failure("checksum missing"); return found; }
export function getReleaseTarget(platform, value) { return { assetArch: arch(platform, value) }; }
export function requireLinuxTarget(platform, value) { arch(platform, value); }
export async function downloadVerifiedRelease(fetch, latestUrl, platform, value, options = {}) {
    const shared = { ...options, deadline: options.deadline ?? Date.now() + (options.timeoutMs ?? 15_000) };
    const raw = await boundedRequest(fetch, latestUrl, MAX_RELEASE_BYTES, true, shared);
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    }
    catch {
        throw failure("latest release response is malformed");
    }
    const release = releaseSchema.safeParse(parsed);
    if (!release.success)
        throw failure("latest release response is malformed");
    const version = release.data.tag_name.replace(/^v/, "");
    const target = `CLIProxyAPI_${version}_linux_${arch(platform, value)}_no-plugin.tar.gz`;
    const assets = release.data.assets.map((item) => asset(item, release.data.tag_name));
    const archive = one(assets, target);
    const checksums = one(assets, "checksums.txt");
    if (archive.size > MAX_ARCHIVE_BYTES || checksums.size > MAX_CHECKSUM_BYTES)
        throw failure("release asset exceeds size limit");
    const archiveBytes = await boundedRequest(fetch, archive.url, MAX_ARCHIVE_BYTES, false, shared);
    if (archiveBytes.byteLength !== archive.size || !same(hash(archiveBytes), archive.digest))
        throw failure("archive digest or size mismatch");
    const checksumBytes = await boundedRequest(fetch, checksums.url, MAX_CHECKSUM_BYTES, false, shared);
    if (checksumBytes.byteLength !== checksums.size || !same(hash(checksumBytes), checksums.digest) || !same(checksum(checksumBytes, target), archive.digest))
        throw failure("checksums digest or size mismatch");
    return { version, archive: archiveBytes, archiveDigest: archive.digest };
}
//# sourceMappingURL=cliproxyapi-release.js.map