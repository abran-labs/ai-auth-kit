import { gunzipSync } from "node:zlib";

const BLOCK_SIZE = 512;
const MAX_TAR_BYTES = 128 * 1024 * 1024;
const EXECUTABLE_PATH = "./cli-proxy-api";
function failure(message: string): Error { return new Error(`CLIProxyAPI archive is invalid: ${message}`); }
function zero(block: Uint8Array): boolean { return block.every((byte) => byte === 0); }
function text(header: Uint8Array, start: number, length: number, trim = true): string { const raw = Buffer.from(header.subarray(start, start + length)).toString("utf8"); const end = raw.indexOf("\0"); const value = end < 0 ? raw : raw.slice(0, end); return trim ? value.trim() : value; }
function validChecksum(header: Uint8Array): boolean { const raw = text(header, 148, 8); if (!/^[0-7]+$/.test(raw)) return false; let sum = 0; for (let index = 0; index < BLOCK_SIZE; index += 1) sum += index >= 148 && index < 156 ? 32 : header[index] ?? 0; return sum === Number.parseInt(raw, 8); }
function size(header: Uint8Array): number { const raw = text(header, 124, 12); if (!/^[0-7]*$/.test(raw)) throw failure("tar entry size is malformed"); const value = raw.length === 0 ? 0 : Number.parseInt(raw, 8); if (!Number.isSafeInteger(value) || value < 0) throw failure("tar entry size is invalid"); return value; }
function exactName(header: Uint8Array): boolean {
	const expected = Buffer.from(EXECUTABLE_PATH, "utf8");
	if (!header.subarray(0, expected.length).every((byte, index) => byte === expected[index])) return false;
	return header.subarray(expected.length, 100).every((byte) => byte === 0);
}

export function extractCliProxyApi(archive: Uint8Array): Uint8Array {
	let tar: Buffer;
	try { tar = gunzipSync(Buffer.from(archive), { maxOutputLength: MAX_TAR_BYTES }); } catch (error) { throw failure(error instanceof Error ? error.message : "gzip decompression failed"); }
	let offset = 0;
	let executable: Uint8Array | undefined;
	while (offset < tar.length) {
		if (offset + BLOCK_SIZE > tar.length) throw failure("tar header exceeds archive bounds");
		const header = tar.subarray(offset, offset + BLOCK_SIZE);
		if (zero(header)) break;
		if (!validChecksum(header)) throw failure("tar header checksum is invalid");
		const entrySize = size(header);
		const start = offset + BLOCK_SIZE;
		const end = start + entrySize;
		const next = start + Math.ceil(entrySize / BLOCK_SIZE) * BLOCK_SIZE;
		if (end > tar.length || next > tar.length) throw failure("tar entry exceeds archive bounds");
		const type = text(header, 156, 1);
		if (type !== "" && type !== "0") throw failure("tar contains a nonregular entry");
		if (exactName(header)) {
			if (header.subarray(345, 500).some((byte) => byte !== 0)) throw failure("tar executable prefix is invalid");
			if (executable) throw failure("tar contains duplicate executable entries");
			executable = tar.subarray(start, end);
		}
		offset = next;
	}
	if (!executable) throw failure("tar does not contain ./cli-proxy-api");
	return executable;
}
