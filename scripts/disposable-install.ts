import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { parseBunLock } from "./dependency-policy.js";

export interface BoundedCommand {
	readonly command: readonly string[];
	readonly cwd: string;
	readonly timeoutMilliseconds: number;
	readonly maxOutputBytes: number;
}

export type BoundedResult =
	| { readonly kind: "exited"; readonly exitCode: number; readonly output: string }
	| { readonly kind: "timed_out"; readonly output: string };

export interface InstalledFixture {
	readonly project: string;
	readonly packageName: string;
	readonly version: string;
}

const installedPackageSchema = z.object({ name: z.string(), version: z.string() });
const terminationGraceMilliseconds = 250;
const reapingDeadlineMilliseconds = 1000;

interface ProcessIdentity {
	readonly pid: number;
	readonly processGroup: number;
	readonly session: number;
	readonly startTime: string;
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function boundedOutput(stream: ReadableStream<Uint8Array>, maximum: number): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	for (;;) {
		const next = await reader.read();
		if (next.done) break;
		const remaining = maximum - length;
		if (remaining <= 0) {
			await reader.cancel();
			break;
		}
		const chunk = next.value.slice(0, remaining);
		chunks.push(chunk);
		length += chunk.length;
		if (chunk.length < next.value.length) {
			await reader.cancel();
			break;
		}
	}
	return new TextDecoder().decode(Bun.concatArrayBuffers(chunks));
}

function missingProcess(error: unknown): boolean {
	return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH");
}

function parseProcessIdentity(pid: number, source: string): ProcessIdentity {
	const closingParenthesis = source.lastIndexOf(")");
	const fields = source.slice(closingParenthesis + 2).trim().split(/\s+/);
	const processGroup = Number(fields[2]);
	const session = Number(fields[3]);
	const startTime = fields[19];
	if (!Number.isInteger(processGroup) || !Number.isInteger(session) || startTime === undefined) {
		throw new Error(`invalid /proc stat for ${pid}`);
	}
	return { pid, processGroup, session, startTime };
}

async function processIdentity(pid: number): Promise<ProcessIdentity | undefined> {
	try {
		return parseProcessIdentity(pid, await readFile(`/proc/${pid}/stat`, "utf8"));
	} catch (error) {
		if (missingProcess(error)) return undefined;
		throw error;
	}
}

async function processGroupMembers(processGroup: number): Promise<readonly ProcessIdentity[]> {
	const entries = await readdir("/proc", { withFileTypes: true });
	const identities = await Promise.all(entries
		.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
		.map((entry) => processIdentity(Number(entry.name))));
	return identities.filter((identity): identity is ProcessIdentity => identity !== undefined && identity.processGroup === processGroup);
}

async function sessionLeader(pid: number): Promise<ProcessIdentity | undefined> {
	const deadline = Date.now() + terminationGraceMilliseconds;
	for (;;) {
		const identity = await processIdentity(pid);
		if (identity === undefined || (identity.processGroup === pid && identity.session === pid)) return identity;
		if (Date.now() >= deadline) throw new Error("setsid did not establish an isolated process group");
		await delay(5);
	}
}

async function groupGone(processGroup: number, deadline: number): Promise<boolean> {
	for (;;) {
		const members = await processGroupMembers(processGroup);
		if (members.length === 0 && !processGroupExists(processGroup)) return true;
		if (Date.now() >= deadline) return false;
		await delay(10);
	}
}

function processGroupExists(processGroup: number): boolean {
	try {
		process.kill(-processGroup, 0);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
		throw error;
	}
}

async function sameProcess(identity: ProcessIdentity): Promise<boolean> {
	const current = await processIdentity(identity.pid);
	return current !== undefined && current.startTime === identity.startTime;
}

function signalProcessGroup(processGroup: number, signal: NodeJS.Signals): void {
	try {
		process.kill(-processGroup, signal);
	} catch (error) {
		if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
	}
}

async function terminateProcessGroup(process: Bun.Subprocess<"ignore", "pipe", "pipe">): Promise<void> {
	const leader = await sessionLeader(process.pid);
	if (leader === undefined) return;
	if (await sameProcess(leader)) signalProcessGroup(leader.processGroup, "SIGTERM");
	const terminated = await groupGone(leader.processGroup, Date.now() + terminationGraceMilliseconds);
	if (!terminated && (await processGroupMembers(leader.processGroup)).length > 0) {
		signalProcessGroup(leader.processGroup, "SIGKILL");
	}
	await process.exited;
	if (!(await groupGone(leader.processGroup, Date.now() + reapingDeadlineMilliseconds))) {
		throw new Error(`process group ${leader.processGroup} survived timeout cleanup`);
	}
}

export async function runBounded(input: BoundedCommand): Promise<BoundedResult> {
	if (input.command.length === 0) throw new Error("bounded command requires an executable");
	const setsid = Bun.which("setsid");
	if (setsid === null) throw new Error("setsid is required for bounded disposable commands");
	const process = Bun.spawn({
		cmd: [setsid, "--wait", ...input.command],
		cwd: input.cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = Promise.all([
		boundedOutput(process.stdout, input.maxOutputBytes),
		boundedOutput(process.stderr, input.maxOutputBytes),
	]).then(([stdout, stderr]) => `${stdout}${stderr}`);
	const outcome = await Promise.race([
		process.exited.then((exitCode) => ({ kind: "exited" as const, exitCode })),
		delay(input.timeoutMilliseconds).then(() => ({ kind: "timed_out" as const })),
	]);
	if (outcome.kind === "exited") return { ...outcome, output: await output };
	await terminateProcessGroup(process);
	return { kind: "timed_out", output: `${(await output).slice(0, input.maxOutputBytes)}\ntimeout after ${input.timeoutMilliseconds}ms` };
}

export async function assertInstalledFixture(fixture: InstalledFixture): Promise<void> {
	let packageSource: string;
	try {
		packageSource = await readFile(join(fixture.project, "node_modules", fixture.packageName, "package.json"), "utf8");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			throw new Error(`installed package missing: ${fixture.packageName}`);
		}
		throw error;
	}
	const installed = installedPackageSchema.parse(JSON.parse(packageSource));
	if (installed.name !== fixture.packageName || installed.version !== fixture.version) {
		throw new Error(`installed package mismatch: expected ${fixture.packageName}@${fixture.version}`);
	}
	const lock = parseBunLock(await readFile(join(fixture.project, "bun.lock"), "utf8"));
	if (lock.get(fixture.packageName) !== fixture.version) {
		throw new Error(`lock resolution mismatch: expected ${fixture.packageName}@${fixture.version}`);
	}
}
