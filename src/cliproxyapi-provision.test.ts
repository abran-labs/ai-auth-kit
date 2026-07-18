import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { provisionCliProxyApi } from "./cliproxyapi.js";
import {
	ARM64_ARCHIVE,
	binaryResponse,
	createReleaseResponse,
	createTarGz,
	createTempDir,
	fixtureFetch,
	isExecutable,
	jsonResponse,
	releaseFixtures,
	readText,
	sha256,
	X64_ARCHIVE,
} from "./cliproxyapi-test-helpers.js";

afterEach(() => {
	mock.restore();
});

function verifiedFetch(archiveName = X64_ARCHIVE): typeof fetch {
	const { archive, checksums } = releaseFixtures(archiveName);
	return fixtureFetch([createReleaseResponse(archive, checksums), binaryResponse(archive.body), binaryResponse(checksums.body)]);
}

test("provisionCliProxyApi ignores PATH binaries and downloads verified release", async () => {
	const dir = await createTempDir();
	const binDir = join(dir, "bin");
	const binaryPath = join(binDir, "cli-proxy-api");
	await mkdir(binDir, { recursive: true });
	await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	const fetch = verifiedFetch();

	const result = await provisionCliProxyApi(join(dir, "cache"), { env: { PATH: binDir }, platform: "linux", arch: "x64", fetch });

	expect(result.source).toBe("download");
	expect(result.binaryPath).not.toBe(binaryPath);
});

test("provisionCliProxyApi downloads exact x64 asset from release assets", async () => {
	const dir = await createTempDir();
	const result = await provisionCliProxyApi(join(dir, "cache"), { env: { PATH: "" }, platform: "linux", arch: "x64", fetch: verifiedFetch() });

	expect(result).toMatchObject({ source: "download", version: "7.2.83" });
	expect(await isExecutable(result.binaryPath)).toBe(true);
	expect(await readText(result.binaryPath)).toBe("#!/bin/sh\necho ok\n");
});

test("provisionCliProxyApi downloads exact arm64 asset from release assets", async () => {
	const dir = await createTempDir();
	const result = await provisionCliProxyApi(join(dir, "cache"), { env: { PATH: "" }, platform: "linux", arch: "arm64", fetch: verifiedFetch(ARM64_ARCHIVE) });

	expect(result.source).toBe("download");
	expect(result.binaryPath).toContain(join(dir, "cache", "linux", "arm64", "7.2.83"));
});

test("provisionCliProxyApi uses a currently validated offline cache after an online provision", async () => {
	const dir = await createTempDir();
	const cache = join(dir, "cache");
	const online = await provisionCliProxyApi(cache, { platform: "linux", arch: "x64", fetch: verifiedFetch() });
	expect(await readText(join(online.binaryPath, "..", "provenance.json"))).toContain('"source":"github-release"');
	const offline = await provisionCliProxyApi(cache, { platform: "linux", arch: "x64", fetch: async () => new Response("offline", { status: 503 }) });
	expect(online.source).toBe("download");
	expect(offline).toEqual({ binaryPath: online.binaryPath, source: "cache" });
});

test("provisionCliProxyApi rejects unsupported systems before PATH or network", async () => {
	for (const platform of ["darwin", "win32", "freebsd"] as const) {
		const fetchSpy = spyOn(globalThis, "fetch");
		const existsSpy = mock(async (): Promise<boolean> => true);
		await expect(provisionCliProxyApi("/unused", { platform, arch: "x64", fetch: globalThis.fetch, fileExists: existsSpy })).rejects.toThrow("unsupported");
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(existsSpy).not.toHaveBeenCalled();
	}
});

test("provisionCliProxyApi accepts only an explicit safe absolute executable", async () => {
	const dir = `/home/linuxpc/explicit-cli-proxy-${Date.now()}`;
	try {
		await mkdir(dir, { recursive: true, mode: 0o700 });
		const binaryPath = join(dir, "cli-proxy-api");
		await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
		const result = await provisionCliProxyApi(join(dir, "cache"), { platform: "linux", arch: "x64", binaryPath });
		expect(result).toEqual({ binaryPath, source: "path" });
		await expect(provisionCliProxyApi(join(dir, "cache"), { platform: "linux", arch: "x64", binaryPath: "relative-cli-proxy-api" })).rejects.toThrow("absolute");
	} finally { await rm(dir, { recursive: true, force: true }); }
});

test("provisionCliProxyApi rejects malformed release assets without cache install", async () => {
	const cases = [
		jsonResponse({ tag_name: "v7.2.83", draft: false, prerelease: false, assets: [] }),
		jsonResponse({ tag_name: "v7.2.83", draft: false, prerelease: false, assets: [{ name: X64_ARCHIVE }, { name: X64_ARCHIVE }, { name: "checksums.txt" }] }),
		jsonResponse({ tag_name: "v7.2.83", draft: false, prerelease: false, assets: [{ name: X64_ARCHIVE }, { name: "checksums.txt" }, { name: "checksums.txt" }] }),
	];
	for (const response of cases) {
		const dir = await createTempDir();
		await expect(provisionCliProxyApi(join(dir, "cache"), { env: { PATH: "" }, platform: "linux", arch: "x64", fetch: fixtureFetch([response]) })).rejects.toThrow("provisioning failed");
		expect(await isExecutable(join(dir, "cache", "linux", "x64", "cli-proxy-api"))).toBe(false);
	}
});

test("provisionCliProxyApi rejects unauthenticated bytes and unsafe archives", async () => {
	const scenarios = [
		{ archive: createTarGz([{ name: "CLIProxyAPI", content: "ok" }]), checksum: "0".repeat(64) },
		{ archive: createTarGz([{ name: "CLIProxyAPI", content: "ok" }, { name: "cli-proxy-api", content: "again" }]), checksum: undefined },
		{ archive: createTarGz([{ name: "CLIProxyAPI", content: "ok", type: "2" }]), checksum: undefined },
	];
	for (const scenario of scenarios) {
		const dir = await createTempDir();
		const archive = { name: X64_ARCHIVE, url: "https://example.invalid/archive", body: scenario.archive };
		const checksum = scenario.checksum ?? sha256(scenario.archive);
		const checksums = { name: "checksums.txt", url: "https://example.invalid/checksums", body: Buffer.from(`${checksum}  ${X64_ARCHIVE}\n`) };
		await expect(provisionCliProxyApi(join(dir, "cache"), { env: { PATH: "" }, platform: "linux", arch: "x64", fetch: fixtureFetch([createReleaseResponse(archive, checksums), binaryResponse(archive.body), binaryResponse(checksums.body)]) })).rejects.toThrow("provisioning failed");
		expect(await isExecutable(join(dir, "cache", "linux", "x64", "cli-proxy-api"))).toBe(false);
	}
});
