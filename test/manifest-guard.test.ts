import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();

test("Given the canonical manifest, when Bun tooling is inspected, then all standalone suites stay native and runnable", async () => {
	const packageManifest = await readFile(join(root, "package.json"), "utf8");
	const bunConfig = await readFile(join(root, "bunfig.toml"), "utf8");

	expect(packageManifest).toContain('"packageManager": "bun@1.3.14"');
	expect(packageManifest).toContain('"version": "1.0.0"');
	expect(packageManifest).toContain('"publishConfig": {');
	expect(packageManifest).toContain('"access": "public"');
	expect(packageManifest).toContain('"registry": "https://registry.npmjs.org/"');
	expect(packageManifest).toContain('"bun": "./src/index.ts"');
	expect(packageManifest).toContain('"test": "bun test"');
	expect(packageManifest).toContain('"test:types": "tsc -p tsconfig.test.json --noEmit"');
	expect(packageManifest).toContain('"audit:dependencies": "bun run scripts/audit-dependencies.ts"');
	expect(packageManifest).toContain('"qa:minimum-release-age": "bun run scripts/qa-minimum-release-age.ts"');
	expect(packageManifest).toContain('"qa:git-consumer": "bun run scripts/qa-git-consumer.ts"');
	expect(packageManifest).toContain('"qa:stale-package": "bun run scripts/qa-stale-package.ts"');
	expect(packageManifest).toContain('"repository": {');
	expect(packageManifest).toContain('"url": "https://github.com/abran-labs/ai-auth-kit.git"');
	expect(packageManifest).not.toContain('"peerDependenciesMeta"');
	expect(packageManifest).not.toContain('"@oh-my-pi/pi-ai"');
	expect(packageManifest).not.toContain('"vitest"');
	expect(packageManifest).not.toContain('"tsx"');
	expect(packageManifest).not.toContain('"prepare"');
	expect(packageManifest).not.toContain('"prepack"');
	expect(packageManifest).not.toContain('"postinstall"');
	expect(packageManifest).not.toContain('"preinstall"');
	expect(packageManifest).not.toContain('"install"');
	expect(packageManifest).not.toContain('"bin"');
	expect(packageManifest).toContain('"release:artifact-verify": "sh scripts/verify-release-artifact.sh"');
	expect(packageManifest).toContain('"release:preflight": "sh scripts/npm-preflight.sh"');
	expect(packageManifest).not.toContain('"installer:');
	expect(bunConfig).toContain("minimumReleaseAge = 604800");
	expect(bunConfig).not.toContain("minimumReleaseAgeExcludes");
	await access(join(root, "bun.lock"));
	let packageLockExists = true;
	try {
		await access(join(root, "package-lock.json"));
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		packageLockExists = false;
	}
	expect(packageLockExists).toBeFalse();

	const discoveredSuites: string[] = [];
	for (const directory of ["src", "test"]) {
		for await (const suite of new Bun.Glob("*.test.ts").scan({
			cwd: join(root, directory),
		})) {
			discoveredSuites.push(`${directory}/${suite}`);
		}
	}
	expect(discoveredSuites).not.toHaveLength(0);
	for (const suite of discoveredSuites) {
		const source = await readFile(join(root, suite), "utf8");
		expect(source).toContain('from "bun:test"');
		expect(source).not.toMatch(/from ["']vitest["']/);
		expect(source).not.toMatch(/^\s*test\.skip\(/m);
		expect(source).not.toMatch(/^\s*test\.todo\(/m);
	}
});
