import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	cleanupManagerFixture,
	createManagerFixture,
} from "./installer-manager-test-helpers.js";

export type CommandResult = {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
};

export type DocsFixture = {
	readonly directory: string;
	readonly environment: Readonly<Record<string, string | undefined>>;
	readonly manager: string;
	readonly cleanup: () => Promise<void>;
};

export async function run(command: readonly string[], cwd: string, env: Readonly<Record<string, string | undefined>> = process.env): Promise<CommandResult> {
	const child = Bun.spawn({ cmd: [...command], cwd, env, stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
	const result = await run(["git", ...args], cwd);
	if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	return result.stdout.trim();
}

async function createGitFixture(directory: string): Promise<{ readonly spec: string; readonly stop: () => void }> {
	const source = join(directory, "git-source");
	const bare = join(directory, "ai-auth-kit.git");
	await mkdir(source);
	await writeFile(join(source, "package.json"), `${JSON.stringify({ name: "@abran-labs/ai-auth-kit", version: "0.2.0", type: "module", exports: "./index.js" })}\n`);
	await writeFile(join(source, "index.js"), 'export const fixtureVersion = "0.2.0";\n');
	await git(source, ["init", "-q"]);
	await git(source, ["add", "."]);
	await git(source, ["-c", "user.name=Docs QA", "-c", "user.email=docs@example.invalid", "commit", "-qm", "fixture"]);
	const sha = await git(source, ["rev-parse", "HEAD"]);
	await git(directory, ["clone", "-q", "--bare", source, bare]);
	await git(bare, ["update-ref", `refs/tags/${sha}`, sha]);
	await git(bare, ["update-server-info"]);
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: async (request) => {
			const pathname = new URL(request.url).pathname;
			if (!pathname.startsWith("/ai-auth-kit.git/")) return new Response("not found", { status: 404 });
			const path = join(directory, pathname);
			try {
				await access(path);
				return new Response(Bun.file(path));
			} catch (error) {
				if (!(error instanceof Error)) throw error;
				return new Response("not found", { status: 404 });
			}
		},
	});
	if (server.port === undefined) throw new Error("Git fixture server did not bind a port");
	return { spec: `git+http://127.0.0.1:${server.port}/ai-auth-kit.git#${sha}`, stop: () => server.stop() };
}

async function createCliFixture(directory: string, root: string): Promise<string> {
	const bin = join(directory, "bin");
	const cli = join(bin, "ai-auth-kit");
	await mkdir(bin);
	await writeFile(cli, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} --bun ${JSON.stringify(join(root, "src", "cli.ts"))} \"$@\"\n`);
	await chmod(cli, 0o700);
	return bin;
}

export async function createDocsFixture(root: string): Promise<DocsFixture> {
	const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-docs-"));
	const consumer = join(directory, "consumer");
	await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), '{"name":"docs-consumer","private":true,"type":"module"}\n');
	const gitFixture = await createGitFixture(directory);
	const initial = await createManagerFixture("0.2.0");
	const update = await createManagerFixture("0.2.1");
	const bin = await createCliFixture(directory, root);
	return {
		directory,
		manager: initial.manager,
		environment: {
			...process.env,
			AI_AUTH_KIT_GIT_SPEC: gitFixture.spec,
			AI_AUTH_KIT_INSTALLER_URL: `file://${join(root, "install.sh")}`,
			AI_AUTH_KIT_MANAGER: initial.manager,
			AI_AUTH_KIT_RELEASE_DIR: initial.release,
			AI_AUTH_KIT_TEST_BUNDLE: initial.localReceipt,
			AI_AUTH_KIT_UPDATE_RELEASE_DIR: update.release,
			AI_AUTH_KIT_UPDATE_TEST_BUNDLE: update.localReceipt,
			AI_AUTH_KIT_UNUSED_RELEASE_DIR: join(directory, "unused-release"),
			DOCS_FIXTURE_ROOT: directory,
			HOME: initial.home,
			XDG_DATA_HOME: join(initial.home, "data"),
			XDG_CACHE_HOME: join(directory, "cache"),
			XDG_CONFIG_HOME: join(directory, "config"),
			XDG_STATE_HOME: join(directory, "state"),
			AI_AUTH_KIT_TEST_LIBC: "glibc",
			PATH: `${bin}:${process.env.PATH ?? ""}`,
		},
		cleanup: async () => {
			gitFixture.stop();
			await Promise.all([
				cleanupManagerFixture(initial.workspace),
				cleanupManagerFixture(update.workspace),
				rm(directory, { force: true, recursive: true }),
			]);
		},
	};
}

export async function compileTypeScriptExamples(readme: string, fixture: string, root: string): Promise<CommandResult> {
	const examples = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
	await writeFile(join(fixture, "package.json"), '{"private":true,"type":"module"}\n');
	const files = await Promise.all(examples.map(async (source, index) => {
		const file = `api-example-${index}.ts`;
		await writeFile(join(fixture, file), source);
		return file;
	}));
	await writeFile(join(fixture, "tsconfig.docs.json"), `${JSON.stringify({
		compilerOptions: {
			target: "ES2022",
			module: "NodeNext",
			moduleResolution: "NodeNext",
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			types: ["bun-types", "node"],
			typeRoots: [join(root, "node_modules"), join(root, "node_modules", "@types")],
			baseUrl: fixture,
			paths: { "@abran-labs/ai-auth-kit": [join(root, "src", "index.ts")] },
		},
		files,
	}, null, 2)}\n`);
	return run([join(root, "node_modules", ".bin", "tsc"), "-p", "tsconfig.docs.json"], fixture);
}

export async function readDocumentation(root: string, paths: readonly string[]): Promise<ReadonlyMap<string, string>> {
	return new Map(await Promise.all(paths.map(async (path) => [path, await readFile(join(root, path), "utf8")] as const)));
}
