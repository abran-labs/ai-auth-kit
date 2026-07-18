import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, mock, test } from "bun:test";
import { extractCliProxyApi } from "./cliproxyapi-archive.js";
import { provisionCliProxyApi } from "./cliproxyapi.js";
import { boundedRequest } from "./cliproxyapi-http.js";
import { createProjectAuthKit } from "./kit.js";
import { loginWithPrompts, type PromptAdapter } from "./picker.js";
import {
	binaryResponse,
	createReleaseResponse,
	createTarGz,
	createTempDir,
	fixtureFetch,
	releaseFixtures,
	readText,
	sha256,
	X64_ARCHIVE,
} from "./cliproxyapi-test-helpers.js";

function provision(cacheDir: string, responses: readonly Response[]) {
	return provisionCliProxyApi(cacheDir, { env: { PATH: "" }, platform: "linux", arch: "x64", fetch: fixtureFetch(responses) });
}

async function expectRejectedWithoutBinary(cacheDir: string, responses: readonly Response[]): Promise<void> {
	await expect(provision(cacheDir, responses)).rejects.toThrow("provisioning failed");
	try { expect(await readdir(join(cacheDir, "linux", "x64"))).toEqual([]); }
	catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
}

function releaseAsset(name: string, body: Uint8Array, changes: { readonly digest?: string; readonly size?: number; readonly state?: string } = {}) {
	return { name, url: `https://example.invalid/${name}`, body, ...changes };
}

test("provisionCliProxyApi rejects release asset metadata trust failures", async () => {
	const fixtures = releaseFixtures();
	const invalidAssets = [
		{ ...fixtures.archive, state: "new" },
		{ ...fixtures.archive, digest: "sha1:bad" },
		{ ...fixtures.archive, digest: "" },
		{ ...fixtures.archive, size: 0 },
		{ ...fixtures.archive, size: 64 * 1024 * 1024 + 1 },
		{ ...fixtures.archive, size: fixtures.archive.body.byteLength + 1 },
	];
	for (const archive of invalidAssets) {
		const cacheDir = join(await createTempDir(), "cache");
		await expectRejectedWithoutBinary(cacheDir, [createReleaseResponse(archive, fixtures.checksums)]);
	}
});

test("provisionCliProxyApi rejects archive and checksums digest failures", async () => {
	const fixtures = releaseFixtures();
	const badApi = releaseAsset(X64_ARCHIVE, fixtures.archive.body, { digest: `sha256:${"0".repeat(64)}` });
	const wrongEntry = Buffer.from(`${"0".repeat(64)}  ${X64_ARCHIVE}\n`);
	const malformedEntry = Buffer.from(`not-a-digest  ${X64_ARCHIVE}\n`);
	const missingEntry = Buffer.from(`${sha256(fixtures.archive.body)}  other.tar.gz\n`);
	const duplicateEntry = Buffer.from(`${sha256(fixtures.archive.body)}  ${X64_ARCHIVE}\n${sha256(fixtures.archive.body)}  ${X64_ARCHIVE}\n`);
	for (const checksumsBody of [wrongEntry, malformedEntry, missingEntry, duplicateEntry]) {
		const checksums = releaseAsset("checksums.txt", checksumsBody);
		const cacheDir = join(await createTempDir(), "cache");
		await expectRejectedWithoutBinary(cacheDir, [createReleaseResponse(fixtures.archive, checksums), binaryResponse(fixtures.archive.body), binaryResponse(checksums.body)]);
	}
	const cacheDir = join(await createTempDir(), "cache");
	await expectRejectedWithoutBinary(cacheDir, [createReleaseResponse(badApi, fixtures.checksums), binaryResponse(fixtures.archive.body)]);
});

test("provisionCliProxyApi rejects checksum metadata failures", async () => {
	const fixtures = releaseFixtures();
	const invalidChecksums = [
		{ ...fixtures.checksums, state: "new" },
		{ ...fixtures.checksums, digest: "sha256:nope" },
		{ ...fixtures.checksums, size: 0 },
		{ ...fixtures.checksums, size: 1024 * 1024 + 1 },
		{ ...fixtures.checksums, size: fixtures.checksums.body.byteLength + 1 },
	];
	for (const checksums of invalidChecksums) {
		const cacheDir = join(await createTempDir(), "cache");
		await expectRejectedWithoutBinary(cacheDir, [createReleaseResponse(fixtures.archive, checksums), binaryResponse(fixtures.archive.body)]);
	}
});

test("extractCliProxyApi rejects corrupt, oversized, malformed, and out-of-bounds tar data", () => {
	expect(() => extractCliProxyApi(Buffer.from("not-gzip"))).toThrow("archive is invalid");
	expect(() => extractCliProxyApi(createTarGz([]))).toThrow("does not contain");
	const oversized = gzipSync(Buffer.alloc(129 * 1024 * 1024));
	expect(() => extractCliProxyApi(oversized)).toThrow("archive is invalid");
	const truncated = createTarGz([{ name: "./cli-proxy-api", content: "ok" }]).subarray(0, -8);
	expect(() => extractCliProxyApi(truncated)).toThrow("archive is invalid");
	const header = Buffer.alloc(512, 0);
	header.write("file", 0, "utf8");
	header.write("00000002000\0", 124, "utf8");
	expect(() => extractCliProxyApi(gzipSync(Buffer.concat([header, Buffer.alloc(512, 0)])))).toThrow("checksum");
});

test("provisionCliProxyApi rejects an unsafe pre-existing cache directory", async () => {
	const dir = await createTempDir();
	const cacheDir = join(dir, "cache");
	const fixtures = releaseFixtures();
	const binaryPath = join(cacheDir, "linux", "x64", "cli-proxy-api");
	await mkdir(join(cacheDir, "linux", "x64"), { recursive: true });
	await writeFile(binaryPath, "concurrent verified binary");
	await expect(provision(cacheDir, [createReleaseResponse(fixtures.archive, fixtures.checksums), binaryResponse(fixtures.archive.body), binaryResponse(fixtures.checksums.body)])).rejects.toThrow("unsafe cache");
	const entries = await readdir(join(cacheDir, "linux", "x64"));
	expect(entries).toEqual(["cli-proxy-api"]);
	expect(await readText(binaryPath)).toBe("concurrent verified binary");
});

test("provisionCliProxyApi rejects a tampered cache before offline reuse", async () => {
	const dir = await createTempDir();
	const cacheDir = join(dir, "cache");
	const fixtures = releaseFixtures();
	const installed = await provision(cacheDir, [createReleaseResponse(fixtures.archive, fixtures.checksums), binaryResponse(fixtures.archive.body), binaryResponse(fixtures.checksums.body)]);
	await writeFile(installed.binaryPath, "tampered", { mode: 0o755 });
	await expect(provisionCliProxyApi(cacheDir, { platform: "linux", arch: "x64", fetch: async () => new Response("offline", { status: 503 }) })).rejects.toThrow("request failed");
});

test("provisionCliProxyApi never falls back to cache after integrity failure", async () => {
	const dir = await createTempDir();
	const cacheDir = join(dir, "cache");
	const fixtures = releaseFixtures();
	await provision(cacheDir, [createReleaseResponse(fixtures.archive, fixtures.checksums), binaryResponse(fixtures.archive.body), binaryResponse(fixtures.checksums.body)]);
	const bad = { ...fixtures.archive, digest: `sha256:${"0".repeat(64)}` };
	await expect(provision(cacheDir, [createReleaseResponse(bad, fixtures.checksums), binaryResponse(fixtures.archive.body)])).rejects.toThrow("digest");
});

test("timeout cancels a hanging response body", async () => {
	let cancelled = false;
	const body = new ReadableStream<Uint8Array>({ start() {}, cancel() { cancelled = true; } });
	await expect(boundedRequest(async () => new Response(body), "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest", 64, true, { timeoutMs: 10 })).rejects.toThrow("deadline");
	expect(cancelled).toBe(true);
});

test("redirect and 503 responses cancel their bodies", async () => {
	for (const response of [new Response(new ReadableStream({ cancel() {} }), { status: 503 }), new Response(new ReadableStream({ cancel() {} }), { status: 302, headers: { location: "https://evil.invalid/a" } })]) {
		let cancelled = false;
		const tracked = new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }), { status: response.status, headers: response.headers });
		await expect(boundedRequest(async () => tracked, "https://github.com/router-for-me/CLIProxyAPI/releases/download/v7.2.83/a", 64, false)).rejects.toThrow();
		expect(cancelled).toBe(true);
	}
});

test("picker does not run login or save when verified provisioning fails", async () => {
	const rootDir = await mkdtemp(join(tmpdir(), "ai-auth-kit-picker-"));
	const kit = createProjectAuthKit("test-tool", { rootDir });
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: mock().mockResolvedValue("google"),
		select: mock().mockResolvedValue("oauth-external"),
		confirm: mock().mockResolvedValue(true),
		password: mock().mockResolvedValue(""),
		info: () => undefined,
	};
	let loginCalled = false;
	await expect(loginWithPrompts(kit, "google", promptAdapter, {
		provisionCliProxyApi: async () => { throw new Error("unverified release"); },
		runCliProxyApiLogin: async () => { loginCalled = true; },
	})).rejects.toThrow("unverified release");
	expect(loginCalled).toBe(false);
	expect((await kit.readState()).credentials.google).toBeUndefined();
	await rm(rootDir, { recursive: true, force: true });
});
