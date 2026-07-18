import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertNoStalePeerMetadata,
	fetchRegistryMetadata,
	parseRegistryMetadata,
	requireAgeRejection,
} from "./dependency-policy.js";
import { assertInstalledFixture, runBounded, type BoundedResult } from "./disposable-install.js";

interface Fixture {
	readonly name: string;
	readonly publishedAt: string;
	readonly tarballPath: string;
}

interface CommandResult {
	readonly exitCode: number;
	readonly output: string;
}

function completed(result: BoundedResult): CommandResult {
	if (result.kind === "timed_out") throw new Error(`disposable command timed out: ${result.output}`);
	return result;
}

async function run(command: readonly string[], cwd: string): Promise<CommandResult> {
	return completed(await runBounded({ command, cwd, timeoutMilliseconds: 10000, maxOutputBytes: 4096 }));
}

async function createTarball(root: string, name: string): Promise<string> {
	const packageDirectory = join(root, "package");
	await mkdir(packageDirectory);
	await writeFile(join(packageDirectory, "package.json"), JSON.stringify({ name, version: "1.0.0", type: "module" }));
	await writeFile(join(packageDirectory, "index.js"), "export const fixture = true;\n");
	const tarballPath = join(root, `${name}-1.0.0.tgz`);
	const result = await run(["tar", "-czf", tarballPath, "package"], root);
	if (result.exitCode !== 0) throw new Error(`tarball creation failed: ${result.output}`);
	await rm(packageDirectory, { recursive: true });
	return tarballPath;
}

async function createProject(root: string, fixtureName: string, config: string): Promise<string> {
	const project = join(root, `project-${fixtureName}-${Math.random().toString(16).slice(2)}`);
	await mkdir(project);
	await writeFile(join(project, "package.json"), JSON.stringify({ name: fixtureName, version: "1.0.0", dependencies: { [fixtureName]: "1.0.0" } }));
	await writeFile(join(project, "bunfig.toml"), config);
	return project;
}

function packageMetadata(fixture: Fixture, origin: string): Response {
	return Response.json({
		name: fixture.name,
		"dist-tags": { latest: "1.0.0" },
		time: { "1.0.0": fixture.publishedAt },
		versions: {
			"1.0.0": {
				name: fixture.name,
				version: "1.0.0",
				dist: { tarball: `${origin}/${fixture.name}/-/${fixture.name}-1.0.0.tgz` },
			},
		},
	});
}

async function gitStatus(root: string): Promise<string> {
	const result = await run(["git", "status", "--porcelain"], root);
	if (result.exitCode !== 0) throw new Error(`git status failed: ${result.output}`);
	return result.output;
}

const repositoryRoot = process.cwd();
const initialGitStatus = await gitStatus(repositoryRoot);
const temporaryRoot = await mkdtemp(join(tmpdir(), "ai-auth-kit-release-age-"));
let server: ReturnType<typeof Bun.serve> | undefined;
const registryRequests = { oldMetadata: 0, youngMetadata: 0, oldTarball: 0, youngTarball: 0 };

try {
	const fixtureSuffix = crypto.randomUUID().replaceAll("-", "");
	const oldFixture: Fixture = {
		name: `fixture-old-${fixtureSuffix}`,
		publishedAt: "2026-07-09T00:00:00.000Z",
		tarballPath: await createTarball(temporaryRoot, `fixture-old-${fixtureSuffix}`),
	};
	const youngFixture: Fixture = {
		name: `fixture-young-${fixtureSuffix}`,
		publishedAt: "2026-07-16T00:00:00.000Z",
		tarballPath: await createTarball(temporaryRoot, `fixture-young-${fixtureSuffix}`),
	};
	server = Bun.serve({
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			const origin = url.origin;
			if (url.pathname === `/${oldFixture.name}`) {
				registryRequests.oldMetadata += 1;
				return packageMetadata(oldFixture, origin);
			}
			if (url.pathname === `/${youngFixture.name}`) {
				registryRequests.youngMetadata += 1;
				return packageMetadata(youngFixture, origin);
			}
			if (url.pathname === `/${oldFixture.name}/-/${oldFixture.name}-1.0.0.tgz`) {
				registryRequests.oldTarball += 1;
				return new Response(Bun.file(oldFixture.tarballPath));
			}
			if (url.pathname === `/${youngFixture.name}/-/${youngFixture.name}-1.0.0.tgz`) {
				registryRequests.youngTarball += 1;
				return new Response(Bun.file(youngFixture.tarballPath));
			}
			if (url.pathname === "/fixture-timeout") return new Promise((resolve) => setTimeout(() => resolve(Response.json({ time: {} })), 100));
			return new Response("not found", { status: 404 });
		},
	});
	const registry = `http://127.0.0.1:${server.port}`;
	const policy = `[install]\nregistry = "${registry}"\nminimumReleaseAge = 604800\n`;

	const youngProject = await createProject(temporaryRoot, youngFixture.name, policy);
	const youngInstall = await run(["bun", "install", "--ignore-scripts"], youngProject);
	requireAgeRejection(youngInstall.exitCode, youngInstall.output);
	if (await Bun.file(join(youngProject, "node_modules", youngFixture.name, "package.json")).exists()) throw new Error("young fixture was installed despite release-age rejection");
	console.log("young=REJECTED minimum release age");

	const oldProject = await createProject(temporaryRoot, oldFixture.name, policy);
	const oldInstall = await run(["bun", "install", "--ignore-scripts"], oldProject);
	if (oldInstall.exitCode !== 0) throw new Error(`old fixture was not accepted: ${oldInstall.output}`);
	await assertInstalledFixture({ project: oldProject, packageName: oldFixture.name, version: "1.0.0" });
	if (registryRequests.oldMetadata === 0 || registryRequests.oldTarball === 0) throw new Error("old fixture install did not resolve and download from the disposable registry");
	console.log("old=ACCEPTED installed+lock=VERIFIED");

	const beforeFrozenInstall = await readFile(join(oldProject, "bun.lock"), "utf8");
	const frozenInstall = await run(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], oldProject);
	const afterFrozenInstall = await readFile(join(oldProject, "bun.lock"), "utf8");
	if (frozenInstall.exitCode !== 0 || beforeFrozenInstall !== afterFrozenInstall) throw new Error(`frozen lock was not deterministic: ${frozenInstall.output}`);
	console.log("frozen-lock=DETERMINISTIC");

	const excludedProject = await createProject(temporaryRoot, youngFixture.name, `${policy}minimumReleaseAgeExcludes = ["${youngFixture.name}"]\n`);
	const excludedInstall = await run(["bun", "install", "--ignore-scripts"], excludedProject);
	if (excludedInstall.exitCode !== 0) throw new Error(`explicit exclusion was not accepted: ${excludedInstall.output}`);
	await assertInstalledFixture({ project: excludedProject, packageName: youngFixture.name, version: "1.0.0" });
	if (registryRequests.youngMetadata === 0 || registryRequests.youngTarball === 0) throw new Error("excluded fixture install did not resolve and download from the disposable registry");
	console.log("exclusion=ACCEPTED explicit fixture-young installed+lock=VERIFIED");

	await expectTimeout(fetchRegistryMetadata(registry, "fixture-timeout", 1));
	console.log("network-timeout=REJECTED");
	const staleLock = '{ "workspaces": { "": { "peerDependencies": { "ai": "*" } } } }';
	try {
		assertNoStalePeerMetadata(staleLock, {});
		throw new Error("stale lock probe unexpectedly succeeded");
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes("stale peer metadata")) throw error;
	}
	console.log("stale-lock=REJECTED");
	try {
		parseRegistryMetadata('{ "time": { "1.0.0": "malformed" } }');
		throw new Error("malformed metadata probe unexpectedly succeeded");
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes("invalid publish time")) throw error;
	}
	console.log("malformed-metadata=REJECTED");
	try {
		requireAgeRejection(0, "installed fixture-young successfully");
		throw new Error("misleading success probe unexpectedly succeeded");
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes("expected minimum release age rejection")) throw error;
	}
	console.log("misleading-success=REJECTED");
	if (await gitStatus(repositoryRoot) !== initialGitStatus) throw new Error("dirty worktree changed during disposable registry QA");
	console.log("dirty-worktree=UNCHANGED");
} finally {
	server?.stop(true);
	await rm(temporaryRoot, { recursive: true, force: true });
}

async function expectTimeout(operation: Promise<unknown>): Promise<void> {
	try {
		await operation;
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") return;
		throw error;
	}
	throw new Error("timeout probe unexpectedly succeeded");
}
