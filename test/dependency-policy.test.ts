import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
	auditChangedLockAges,
	assertNoStalePeerMetadata,
	parseBunLock,
	parseRegistryMetadata,
	requireAgeRejection,
} from "../scripts/dependency-policy.js";
import { assertInstalledFixture, runBounded } from "../scripts/disposable-install.js";

const root = process.cwd();
const now = Date.parse("2026-07-17T00:00:00.000Z");

test("Given an unchanged lock, when its ages are audited, then no existing resolution is treated as newly resolved", async () => {
	// Given
	const lock = await readFile(join(root, "bun.lock"), "utf8");
	const metadata = JSON.stringify({ time: { "4.4.3": "invalid-date" } });

	// When
	const violations = auditChangedLockAges({ currentLock: lock, baselineLock: lock, metadataByPackage: new Map([["zod", metadata]]), now });

	// Then
	expect(violations).toEqual([]);
});

test("Given a new young package resolution, when registry metadata is audited, then it is rejected", () => {
	// Given
	const baseline = '{ "packages": {} }';
	const current = '{ "packages": { "fixture-young": ["fixture-young@1.0.0", "", {}] } }';
	const metadata = JSON.stringify({ time: { "1.0.0": "2026-07-16T00:00:00.000Z" } });

	// When
	const violations = auditChangedLockAges({ currentLock: current, baselineLock: baseline, metadataByPackage: new Map([["fixture-young", metadata]]), now });

	// Then
	expect(violations).toEqual(["fixture-young@1.0.0: minimum release age not met"]);
});

test("Given a new old package resolution, when registry metadata is audited, then it is accepted", () => {
	// Given
	const baseline = '{ "packages": {} }';
	const current = '{ "packages": { "fixture-old": ["fixture-old@1.0.0", "", {}] } }';
	const metadata = JSON.stringify({ time: { "1.0.0": "2026-07-09T00:00:00.000Z" } });

	// When
	const violations = auditChangedLockAges({ currentLock: current, baselineLock: baseline, metadataByPackage: new Map([["fixture-old", metadata]]), now });

	// Then
	expect(violations).toEqual([]);
});

test("Given malformed or hostile registry metadata, when parsed, then it fails closed", () => {
	// Given / When
	const malformedDate = () => parseRegistryMetadata('{ "time": { "1.0.0": "nope" } }');
	const hostileShape = () => parseRegistryMetadata('{ "time": { "1.0.0": { "date": "2026-01-01" } } }');

	// Then
	expect(malformedDate).toThrow("invalid publish time");
	expect(hostileShape).toThrow();
});

test("Given stale lock peers or a misleading successful install, when policy probes run, then both fail", () => {
	// Given
	const staleLock = '{ "workspaces": { "": { "peerDependencies": { "ai": "*" } } } }';

	// When
	const stalePeer = () => assertNoStalePeerMetadata(staleLock, {});
	const misleadingSuccess = () => requireAgeRejection(0, "installed fixture-young successfully");

	// Then
	expect(stalePeer).toThrow("stale peer metadata");
	expect(misleadingSuccess).toThrow("expected minimum release age rejection");
});

test("Given a current Bun lock, when parsed, then every runtime resolution has a deterministic exact version", async () => {
	// Given
	const lock = await readFile(join(root, "bun.lock"), "utf8");

	// When
	const packages = parseBunLock(lock);

	// Then
	expect(packages.get("zod")).toBe("4.4.3");
	expect(packages.get("@clack/prompts")).toBe("1.7.0");
});

test("Given a hanging fake Bun with a child process, when the bounded runner expires, then it kills the process group", async () => {
	// Given
	const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-hanging-bun-"));
	const pidPath = join(directory, "child.pid");
	const fakeBun = join(directory, "fake-bun");
	await writeFile(fakeBun, `#!/bin/sh\nsleep 30 &\nprintf '%s' "$!" > "${pidPath}"\nwait\n`);
	await chmod(fakeBun, 0o700);

	try {
		// When
		const result = await runBounded({ command: [fakeBun], cwd: directory, timeoutMilliseconds: 100, maxOutputBytes: 1024 });

		// Then
		expect(result.kind).toBe("timed_out");
		expect(result.output).toContain("timeout after 100ms");
		const childPid = Number(await readFile(pidPath, "utf8"));
		expect(() => process.kill(childPid, 0)).toThrow();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("Given a completed fixture install, when its package and lock are checked, then a missing package fails closed", async () => {
	// Given
	const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-installed-fixture-"));
	const packageDirectory = join(directory, "node_modules", "fixture-old");
	await Bun.write(join(packageDirectory, "package.json"), JSON.stringify({ name: "fixture-old", version: "1.0.0" }));
	await writeFile(join(directory, "bun.lock"), '{ "packages": { "fixture-old": ["fixture-old@1.0.0", "", {}] } }');

	try {
		// When / Then
		await expect(assertInstalledFixture({ project: directory, packageName: "fixture-old", version: "1.0.0" })).resolves.toBeUndefined();
		await expect(assertInstalledFixture({ project: directory, packageName: "fixture-missing", version: "1.0.0" })).rejects.toThrow("installed package missing");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
