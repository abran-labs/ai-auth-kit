import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "bun:test";

import { DOCUMENT_PATHS, documentationViolations, helpFlags, shellBlocks } from "../scripts/docs-policy.js";
import {
	compileTypeScriptExamples,
	createDocsFixture,
	type DocsFixture,
	readDocumentation,
	run,
} from "./docs-smoke-helpers.js";

const root = resolve(import.meta.dirname, "..");
let fixture: DocsFixture;
let documents: ReadonlyMap<string, string>;
let cliHelp: string;
let managerHelp: string;

beforeAll(async () => {
	fixture = await createDocsFixture(root);
	documents = await readDocumentation(root, DOCUMENT_PATHS);
	const cli = await run([process.execPath, "--bun", "src/cli.ts", "--help"], root, fixture.environment);
	const manager = await run([fixture.manager, "--help"], root, fixture.environment);
	if (cli.exitCode !== 0 || manager.exitCode !== 0) throw new Error(`Executable help failed:\n${cli.stderr}${manager.stderr}`);
	cliHelp = cli.stdout;
	managerHelp = manager.stdout;
}, 120_000);

afterAll(async () => fixture.cleanup(), 30_000);

test("Given canonical documentation, when executable contracts are compared, then policy, package exports, and help stay synchronized", async () => {
	// Given
	const readme = documents.get("README.md") ?? "";
	const canonicalDocumentation = [...documents.values()].join("\n");
	const packageSource = await readFile(join(root, "package.json"), "utf8");
	const publicApi = await import("../src/index.js");
	const typescriptExamples = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] ?? "").join("\n");
	const importedNames = [...typescriptExamples.matchAll(/import \{([^}]+)\} from "@abran-labs\/ai-auth-kit";/g)]
		.flatMap((match) => (match[1] ?? "").split(",").map((name) => name.trim()).filter(Boolean));

	// When
	const violations = documentationViolations(documents, { supportedCliFlags: helpFlags(cliHelp) });

	// Then
	expect(violations).toEqual([]);
	for (const name of importedNames) expect(Object.hasOwn(publicApi, name), name).toBeTrue();
	expect(packageSource).toContain('"bun": "./src/index.ts"');
	expect(packageSource).toContain('"types": "./dist/index.d.ts"');
	expect(packageSource).toContain('"import": "./dist/index.js"');
	expect(packageSource).toContain('"ai-auth-kit": "./dist/cli.js"');
	expect(canonicalDocumentation).toContain(cliHelp.trimEnd());
	expect(canonicalDocumentation).toContain(managerHelp.trimEnd());
	expect(readme).toContain("https://abran-labs.github.io/ai-auth-kit/");
	expect(readme).toContain("## Start in 60 seconds");
	expect(readme).not.toContain("--attestation-receipt");
	for (const flag of ["--project", "-p", "--version", "-V", "--help", "-h"]) expect(helpFlags(cliHelp).has(flag), flag).toBeTrue();
});

test("Given README API examples, when TypeScript checks them against the source export, then signatures compile", async () => {
	// Given
	const readme = documents.get("README.md") ?? "";

	// When
	const result = await compileTypeScriptExamples(readme, fixture.directory, root);

	// Then
	expect(`${result.stdout}${result.stderr}`).toBe("");
	expect(result.exitCode).toBe(0);
});

test("Given canonical local Git and signed manager fixtures, when every documented shell block runs, then commands succeed", async () => {
	// Given
	const blocks = shellBlocks(documents);
	expect(blocks.map((block) => block.id).sort()).toEqual([
		"cli-noninteractive",
		"immutable-git-consumer",
		"installer-help",
		"manager-local-lifecycle",
	]);

	// When
	const results = [];
	for (const block of blocks) results.push({ ...await run(["sh", "-eu", "-c", block.command], root, fixture.environment), id: block.id });

	// Then
	for (const result of results) expect(result.exitCode, `${result.id}: ${result.stderr}`).toBe(0);
});
