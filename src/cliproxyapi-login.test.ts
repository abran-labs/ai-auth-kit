import { EventEmitter } from "node:events";
import { readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, mock, test } from "bun:test";
import { DEFAULT_PROVIDERS } from "./catalog.js";
import { runCliProxyApiLogin } from "./cliproxyapi.js";
import { createTempDir } from "./cliproxyapi-test-helpers.js";

class MockChildProcess extends EventEmitter {
	emitExit(code: number | null, signal: NodeJS.Signals | null = null): boolean {
		return this.emit("exit", code, signal);
	}
}

function provider(id: string) {
	const result = DEFAULT_PROVIDERS.find((entry) => entry.id === id);
	if (!result) throw new Error(`Missing provider fixture: ${id}`);
	return result;
}

function spawnBarrier(): { readonly registered: Promise<void>; readonly register: () => void } {
	let resolve: (() => void) | undefined;
	const registered = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		registered,
		register: () => {
			if (resolve === undefined) throw new Error("Spawn barrier was not initialized");
			resolve();
		},
	};
}

test("runCliProxyApiLogin uses fixed Google argument without shell", async () => {
	const binaryPath = join(await createTempDir(), "cli-proxy-api");
	await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	const child = new MockChildProcess();
	const barrier = spawnBarrier();
	const spawn = mock((_: string, __: readonly string[], ___: object) => {
		barrier.register();
		return child;
	});
	const login = runCliProxyApiLogin(binaryPath, provider("google"), { spawn });
	await barrier.registered;
	child.emitExit(0);

	await expect(login).resolves.toEqual({ binaryPath, args: ["--antigravity-login"] });
	expect(spawn.mock.calls[0]?.[0]).toContain(`/proc/${process.pid}/fd/`);
});

test("runCliProxyApiLogin uses fixed Claude argument and reports exit failures", async () => {
	const binaryPath = join(await createTempDir(), "cli-proxy-api");
	await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	const child = new MockChildProcess();
	const barrier = spawnBarrier();
	const login = runCliProxyApiLogin(binaryPath, provider("anthropic"), {
		spawn: mock((_: string, __: readonly string[], ___: object) => {
			barrier.register();
			return child;
		}),
	});
	await barrier.registered;
	child.emitExit(2);

	await expect(login).rejects.toThrow("process exited with exit code 2");
});

test("runCliProxyApiLogin executes the opened inode after replacement and rejects a symlink", async () => {
	const dir = await createTempDir();
	const binaryPath = join(dir, "cli-proxy-api");
	const replacementPath = join(dir, "replacement");
	await writeFile(binaryPath, "opened", { mode: 0o755 });
	await writeFile(replacementPath, "replacement", { mode: 0o755 });
	const child = new MockChildProcess();
	const barrier = spawnBarrier();
	let command = "";
	const login = runCliProxyApiLogin(binaryPath, provider("google"), {
		spawn: (path) => {
			command = path;
			barrier.register();
			return child;
		},
	});
	await barrier.registered;
	await rename(replacementPath, binaryPath);
	expect(command).toContain(`/proc/${process.pid}/fd/`);
	await expect(readFile(command, "utf8")).resolves.toBe("opened");
	child.emitExit(0);
	await expect(login).resolves.toMatchObject({ binaryPath });
	await expect(readFile(binaryPath, "utf8")).resolves.toBe("replacement");
	await symlink("/dev/null", replacementPath);
	await expect(runCliProxyApiLogin(replacementPath, provider("google"), { spawn: () => child })).rejects.toThrow("unsafe");
});

test("runCliProxyApiLogin rejects FIFO without spawning or blocking", async () => {
	const fifoPath = join(await createTempDir(), "cli-proxy-api");
	expect(Bun.spawnSync(["mkfifo", fifoPath]).exitCode).toBe(0);
	let spawned = false;
	const started = Date.now();
	await expect(runCliProxyApiLogin(fifoPath, provider("google"), { spawn: () => { spawned = true; return new MockChildProcess(); } })).rejects.toThrow("unsafe");
	expect(Date.now() - started).toBeLessThan(500);
	expect(spawned).toBe(false);
});
