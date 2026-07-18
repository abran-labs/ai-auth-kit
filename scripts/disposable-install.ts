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

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
	try {
		process.kill(-pid, signal);
	} catch (error) {
		if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
	}
}

async function terminateProcessGroup(process: Bun.Subprocess<"ignore", "pipe", "pipe">): Promise<void> {
	signalProcessGroup(process.pid, "SIGTERM");
	const terminated = await Promise.race([process.exited.then(() => true), delay(250).then(() => false)]);
	if (!terminated) {
		signalProcessGroup(process.pid, "SIGKILL");
		await process.exited;
	}
}

export async function runBounded(input: BoundedCommand): Promise<BoundedResult> {
	if (input.command.length === 0) throw new Error("bounded command requires an executable");
	const process = Bun.spawn({
		cmd: ["setsid", "--wait", ...input.command],
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
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { parseBunLock } from "./dependency-policy.js";
