import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
	assertNoStalePeerMetadata,
	auditChangedLockAges,
	parseBunLock,
} from "./dependency-policy.js";

const manifestSchema = z.object({
	dependencies: z.record(z.string(), z.string()),
	peerDependencies: z.record(z.string(), z.string()).default({}),
});
const packageMetadataSchema = z.object({ license: z.string() });

interface Options {
	readonly baselinePath?: string;
	readonly registry: string;
}

function parseOptions(args: readonly string[]): Options {
	const baselineIndex = args.indexOf("--baseline");
	const registryIndex = args.indexOf("--registry");
	if (baselineIndex >= 0 && args[baselineIndex + 1] === undefined) throw new Error("--baseline requires a path");
	if (registryIndex >= 0 && args[registryIndex + 1] === undefined) throw new Error("--registry requires a URL");
	return {
		baselinePath: baselineIndex >= 0 ? args[baselineIndex + 1] : undefined,
		registry: registryIndex >= 0 ? args[registryIndex + 1] : "https://registry.npmjs.org",
	};
}

async function sourceFiles(directory: string): Promise<readonly string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
	}));
	return nested.flat();
}

function importedPackages(source: string): readonly string[] {
	return [...source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)]
		.map((match) => match[1])
		.filter((specifier): specifier is string => specifier !== undefined)
		.filter((specifier) => !specifier.startsWith(".") && !specifier.startsWith("node:"));
}

async function importsByDependency(root: string, dependencies: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, readonly string[]>> {
	const matches = new Map<string, string[]>();
	for (const dependency of Object.keys(dependencies)) matches.set(dependency, []);
	for (const file of await sourceFiles(join(root, "src"))) {
		for (const specifier of importedPackages(await readFile(file, "utf8"))) {
			const dependency = Object.keys(dependencies).find((name) => specifier === name || specifier.startsWith(`${name}/`));
			if (dependency !== undefined) matches.get(dependency)?.push(file.slice(root.length + 1));
		}
	}
	return matches;
}

async function registryMetadata(registry: string, packageName: string): Promise<string> {
	const response = await fetch(`${registry.replace(/\/$/, "")}/${encodeURIComponent(packageName)}`, {
		signal: AbortSignal.timeout(10000),
	});
	if (!response.ok) throw new Error(`registry metadata request failed for ${packageName}: ${response.status}`);
	return response.text();
}

const root = process.cwd();
const options = parseOptions(process.argv.slice(2));
const manifestSource = await readFile(join(root, "package.json"), "utf8");
const lockSource = await readFile(join(root, "bun.lock"), "utf8");
const manifest = manifestSchema.parse(JSON.parse(manifestSource));
assertNoStalePeerMetadata(lockSource, manifest.peerDependencies);
const resolutions = parseBunLock(lockSource);
const imports = await importsByDependency(root, manifest.dependencies);

console.log("Dependency audit: retained runtime dependencies");
for (const [name, declared] of Object.entries(manifest.dependencies).sort(([left], [right]) => left.localeCompare(right))) {
	const files = imports.get(name) ?? [];
	if (files.length === 0) throw new Error(`unused runtime dependency: ${name}`);
	const metadata = packageMetadataSchema.parse(JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8")));
	const resolved = resolutions.get(name);
	if (resolved === undefined) throw new Error(`runtime dependency missing from bun.lock: ${name}`);
	console.log(`${name}\n  imports: ${files.join(", ")}\n  license: ${metadata.license}\n  declared: ${declared}\n  locked: ${resolved}`);
}

if (options.baselinePath === undefined) {
	console.log("Lock age: no baseline supplied; existing frozen lock is not retroactively age-audited.");
} else {
	const baseline = await readFile(options.baselinePath, "utf8");
	const metadata = new Map<string, string>();
	for (const [name, version] of parseBunLock(lockSource)) {
		if (parseBunLock(baseline).get(name) !== version) metadata.set(name, await registryMetadata(options.registry, name));
	}
	const violations = auditChangedLockAges({ currentLock: lockSource, baselineLock: baseline, metadataByPackage: metadata, now: Date.now() });
	if (violations.length > 0) throw new Error(`Lock age audit failed:\n${violations.join("\n")}`);
	console.log("Lock age: all newly changed npm resolutions meet the seven-day minimum.");
}
