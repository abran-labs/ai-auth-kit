import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const VERSION = "v7.2.83";
export const X64_ARCHIVE = "CLIProxyAPI_7.2.83_linux_amd64_no-plugin.tar.gz";
export const ARM64_ARCHIVE = "CLIProxyAPI_7.2.83_linux_aarch64_no-plugin.tar.gz";

export async function createTempDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "ai-auth-kit-cliproxyapi-"));
}

export async function isExecutable(path: string): Promise<boolean> {
	try {
		await access(path, fsConstants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export async function readText(path: string): Promise<string> {
	return readFile(path, "utf8");
}

export function sha256(data: Uint8Array): string {
	return createHash("sha256").update(data).digest("hex");
}

export function createTarGz(entries: readonly TarEntry[]): Uint8Array {
	const blocks: Buffer[] = [];
	for (const entry of entries) {
		const content = Buffer.from(entry.content, "utf8");
		const header = Buffer.alloc(512, 0);
		header.write(entry.name, 0, Math.min(entry.name.length, 100), "utf8");
		header.write("0000755\0", 100, "utf8");
		header.write(`${content.length.toString(8).padStart(11, "0")}\0`, 124, "utf8");
		header.write(entry.type ?? "0", 156, "utf8");
		header.write("ustar\0", 257, "utf8");
		header.write("00", 263, "utf8");
		header.fill(32, 148, 156);
		let checksum = 0;
		for (const byte of header) checksum += byte;
		header.write(checksum.toString(8).padStart(6, "0"), 148, "utf8");
		header[154] = 0;
		header[155] = 32;
		blocks.push(header, content, Buffer.alloc((512 - (content.length % 512)) % 512));
	}
	blocks.push(Buffer.alloc(1024, 0));
	return gzipSync(Buffer.concat(blocks));
}

export interface TarEntry {
	readonly name: string;
	readonly content: string;
	readonly type?: string;
}

export interface ReleaseAssetFixture {
	readonly name: string;
	readonly url: string;
	readonly body: Uint8Array;
	readonly digest?: string;
	readonly size?: number;
	readonly state?: string;
}

export function createReleaseResponse(
	archive: ReleaseAssetFixture,
	checksums: ReleaseAssetFixture,
): Response {
	const asset = (fixture: ReleaseAssetFixture) => ({
		name: fixture.name,
		browser_download_url: fixture.url,
		digest: fixture.digest ?? `sha256:${sha256(fixture.body)}`,
		size: fixture.size ?? fixture.body.byteLength,
		state: fixture.state ?? "uploaded",
	});
	return jsonResponse({ tag_name: VERSION, draft: false, prerelease: false, assets: [asset(archive), asset(checksums)] });
}

export function jsonResponse(value: unknown): Response {
	return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

export function binaryResponse(data: Uint8Array): Response {
	return new Response(Buffer.from(data), { status: 200 });
}

export function fixtureFetch(responses: readonly Response[]): typeof fetch {
	let index = 0;
	return Object.assign(
		async (
			_input: Parameters<typeof fetch>[0],
			_init?: Parameters<typeof fetch>[1],
		): Promise<Response> => {
			const response = responses[index];
			index += 1;
			if (!response) throw new Error("Unexpected fetch request");
			return response;
		},
		{ preconnect: globalThis.fetch.preconnect },
	);
}

export function releaseFixtures(archiveName = X64_ARCHIVE): {
	readonly archive: ReleaseAssetFixture;
	readonly checksums: ReleaseAssetFixture;
} {
	const archiveBody = createTarGz([{ name: "./cli-proxy-api", content: "#!/bin/sh\necho ok\n" }]);
	const baseUrl = "https://github.com/router-for-me/CLIProxyAPI/releases/download/v7.2.83";
	const archive: ReleaseAssetFixture = {
		name: archiveName,
		url: `${baseUrl}/${archiveName}`,
		body: archiveBody,
	};
	const checksumsBody = Buffer.from(`${sha256(archiveBody)}  ${archiveName}\n`, "utf8");
	return {
		archive,
		checksums: { name: "checksums.txt", url: `${baseUrl}/checksums.txt`, body: checksumsBody },
	};
}
