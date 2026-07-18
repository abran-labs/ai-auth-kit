import { type SpawnOptions, spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { open } from "node:fs/promises";
import { lstat } from "node:fs/promises";
import { isAbsolute, parse } from "node:path";
import { dirname } from "node:path";
import { extractCliProxyApi } from "./cliproxyapi-archive.js";
import { readOfflineCache, writeVerifiedCache } from "./cliproxyapi-cache.js";
import { CliProxyTransportError } from "./cliproxyapi-http.js";
import { downloadVerifiedRelease, requireLinuxTarget, type CliProxyApiFetch } from "./cliproxyapi-release.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition } from "./types.js";

export const CLIPROXYAPI_REPO = "router-for-me/CLIProxyAPI";
export const CLIPROXYAPI_LATEST_RELEASE_URL = `https://api.github.com/repos/${CLIPROXYAPI_REPO}/releases/latest`;
export interface CliProxyApiProvisionResult { readonly binaryPath: string; readonly source: "path" | "cache" | "download"; readonly version?: string; }
export interface CliProxyApiProvisionDeps { readonly env?: NodeJS.ProcessEnv; readonly platform?: NodeJS.Platform; readonly arch?: string; readonly fetch?: CliProxyApiFetch; readonly fileExists?: (path: string) => Promise<boolean>; readonly timeoutMs?: number; readonly binaryPath?: string; }
interface CliProxyApiChildProcess { once(event: "error", listener: (error: Error) => void): this; once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this; }
export interface CliProxyApiLoginDeps { readonly spawn?: (command: string, args: readonly string[], options: SpawnOptions) => CliProxyApiChildProcess; }
export interface CliProxyApiLoginResult { readonly binaryPath: string; readonly args: readonly string[]; }

function failure(message: string): Error { return new Error(`CLIProxyAPI provisioning failed: ${message}`); }
function loginArgs(provider: ProviderDefinition): readonly string[] { switch (provider.id) { case "anthropic": return ["--claude-login"]; case "google": return ["--antigravity-login"]; default: throw new Error(`CLIProxyAPI login is unsupported for provider ${provider.id}`); } }
function spawnCliProxyApi(command: string, args: readonly string[], options: SpawnOptions): CliProxyApiChildProcess { return spawn(command, [...args], options); }
function cacheDir(kit: Pick<AuthKit, "store">): string { return kit.store.path ? `${dirname(kit.store.path)}/cache/cli-proxy-api` : `${process.cwd()}/.ai-auth-kit/cache/cli-proxy-api`; }
function owner(): number { const value = process.getuid?.(); if (value === undefined) throw failure("Linux executable ownership is unavailable"); return value; }

async function openedExecutable(path: string): Promise<{ readonly path: string; readonly close: () => Promise<void> }> {
	let handle: Awaited<ReturnType<typeof open>>;
	try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK); }
	catch (error) { if (error instanceof Error && "code" in error && error.code === "ELOOP") throw failure("executable is unsafe"); throw error; }
	try {
		const stat = await handle.stat();
		if (!stat.isFile() || stat.uid !== owner() || (stat.mode & 0o022) !== 0 || (stat.mode & 0o111) === 0) throw failure("executable is unsafe");
		return { path: `/proc/${process.pid}/fd/${handle.fd}`, close: () => handle.close() };
	} catch (error) { await handle.close(); throw error; }
}

async function explicitBinary(path: string): Promise<string> {
	if (!isAbsolute(path)) throw failure("explicit binary path must be absolute");
	let current = parse(path).root;
	for (const part of path.slice(current.length).split("/").filter(Boolean)) {
		current = `${current}${current.endsWith("/") ? "" : "/"}${part}`;
		const stat = await lstat(current);
		if (stat.isSymbolicLink() || (stat.uid !== owner() && stat.uid !== 0) || (stat.mode & 0o022) !== 0) throw failure("explicit binary path is unsafe");
		if (current !== path && !stat.isDirectory()) throw failure("explicit binary parent is not a directory");
		if (current === path && (stat.uid !== owner() || !stat.isFile() || (stat.mode & 0o111) === 0)) throw failure("explicit binary is not executable");
	}
	return path;
}

export async function runCliProxyApiLogin(binaryPath: string, provider: ProviderDefinition, deps: CliProxyApiLoginDeps = {}): Promise<CliProxyApiLoginResult> {
	const args = loginArgs(provider);
	const spawnImpl: NonNullable<CliProxyApiLoginDeps["spawn"]> = deps.spawn ?? spawnCliProxyApi;
	const executable = await openedExecutable(binaryPath);
	await new Promise<void>((resolve, reject) => {
		const close = (): void => { void executable.close(); };
		const child = spawnImpl(executable.path, args, { stdio: "inherit", shell: false });
		child.once("error", (error) => { close(); reject(new Error(`CLIProxyAPI login failed for ${provider.name}: ${error.message}`)); });
		child.once("exit", (code, signal) => { close(); if (code === 0) return resolve(); reject(new Error(`CLIProxyAPI login failed for ${provider.name}: process exited with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}`)); });
	});
	return { binaryPath, args };
}

export async function provisionCliProxyApi(cacheDirectory: string, deps: CliProxyApiProvisionDeps = {}): Promise<CliProxyApiProvisionResult> {
	const platform = deps.platform ?? process.platform;
	const arch = deps.arch ?? process.arch;
	requireLinuxTarget(platform, arch);
	if (deps.binaryPath) return { binaryPath: await explicitBinary(deps.binaryPath), source: "path" };
	try {
		const release = await downloadVerifiedRelease(deps.fetch ?? globalThis.fetch, CLIPROXYAPI_LATEST_RELEASE_URL, platform, arch, { timeoutMs: deps.timeoutMs });
		const cached = await writeVerifiedCache(cacheDirectory, arch, release.version, release.archiveDigest, extractCliProxyApi(release.archive));
		return { ...cached, version: release.version };
	} catch (error) {
		if (error instanceof CliProxyTransportError) {
			const offline = await readOfflineCache(cacheDirectory, arch);
			if (offline) return { binaryPath: offline, source: "cache" };
		}
		const message = error instanceof Error ? error.message : String(error);
		throw failure(message.replace(/^CLIProxyAPI provisioning failed: /, ""));
	}
}
export async function provisionCliProxyApiForProvider(kit: Pick<AuthKit, "store">, _provider: ProviderDefinition, deps: CliProxyApiProvisionDeps = {}): Promise<CliProxyApiProvisionResult> { return provisionCliProxyApi(cacheDir(kit), deps); }
