import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();
const baselineSuites = [
	"src/kit.storage.test.ts",
	"src/catalog.test.ts",
	"src/picker.auth-methods.test.ts",
	"src/picker.env-login.test.ts",
	"src/kit.openai-runtime-auth.test.ts",
	"src/picker.openai-oauth.test.ts",
	"src/picker.github-oauth.test.ts",
	"src/picker.cliproxyapi.test.ts",
	"src/picker.cliproxyapi-flow.test.ts",
	"src/cliproxyapi-login.test.ts",
	"src/cliproxyapi-provision.test.ts",
	"src/cliproxyapi-security.test.ts",
	"src/storage.security.test.ts",
	"src/credential-removal.security.test.ts",
] as const;
const completeSuites = [
	...baselineSuites,
	"src/catalog-boundary.test.ts",
	"src/catalog-schema.test.ts",
	"src/catalog-http.test.ts",
	"src/catalog-cache.test.ts",
	"src/catalog-refresh.test.ts",
	"src/catalog-cache-security.test.ts",
	"src/catalog-cache-process.test.ts",
	"src/catalog-integration.test.ts",
	"test/contract.test.ts",
	"test/consumer-types.test.ts",
	"test/cli-project.test.ts",
	"test/cli-storage.test.ts",
	"test/dependency-policy.test.ts",
	"test/manifest-guard.test.ts",
] as const;
const baselineSuiteSet = new Set<string>(baselineSuites);
const baselineTestCount = 59;
const completeTestCount = 110;

test("Given the canonical manifest, when Bun tooling is inspected, then all standalone suites stay native and runnable", async () => {
	const packageManifest = await readFile(join(root, "package.json"), "utf8");
	const bunConfig = await readFile(join(root, "bunfig.toml"), "utf8");

	expect(packageManifest).toContain('"packageManager": "bun@1.3.14"');
	expect(packageManifest).toContain('"version": "0.2.0"');
	expect(packageManifest).toContain('"bun": "./src/index.ts"');
	expect(packageManifest).toContain('"test": "bun test"');
	expect(packageManifest).toContain('"test:types": "tsc -p tsconfig.test.json --noEmit"');
	expect(packageManifest).toContain('"audit:dependencies": "bun run scripts/audit-dependencies.ts"');
	expect(packageManifest).toContain('"qa:minimum-release-age": "bun run scripts/qa-minimum-release-age.ts"');
	expect(packageManifest).not.toContain('"peerDependenciesMeta"');
	expect(packageManifest).not.toContain('"@oh-my-pi/pi-ai"');
	expect(packageManifest).not.toContain('"vitest"');
	expect(packageManifest).not.toContain('"tsx"');
	expect(packageManifest).not.toContain('"prepare"');
	expect(packageManifest).not.toContain('"prepack"');
	expect(bunConfig).toContain("minimumReleaseAge = 604800");
	expect(bunConfig).not.toContain("minimumReleaseAgeExcludes");
	await expect(access(join(root, "bun.lock"))).resolves.toBeNull();
	await expect(access(join(root, "package-lock.json"))).rejects.toThrow();

	const discoveredSuites: string[] = [];
	for (const directory of ["src", "test"]) {
		for await (const suite of new Bun.Glob("*.test.ts").scan({
			cwd: join(root, directory),
		})) {
			discoveredSuites.push(`${directory}/${suite}`);
		}
	}
	expect(discoveredSuites.sort()).toEqual([...completeSuites].sort());

	let discoveredBaselineTestCount = 0;
	let discoveredCompleteTestCount = 0;
	for (const suite of completeSuites) {
		const source = await readFile(join(root, suite), "utf8");
		expect(source).toContain('from "bun:test"');
		expect(source).not.toMatch(/from ["']vitest["']/);
		expect(source).not.toMatch(/^\s*test\.skip\(/m);
		expect(source).not.toMatch(/^\s*test\.todo\(/m);
		const testCount = source.match(/\btest\s*\(/g)?.length ?? 0;
		discoveredCompleteTestCount += testCount;
		if (baselineSuiteSet.has(suite)) {
			discoveredBaselineTestCount += testCount;
		}
	}
	expect(discoveredBaselineTestCount).toBe(baselineTestCount);
	expect(discoveredCompleteTestCount).toBe(completeTestCount);
});
