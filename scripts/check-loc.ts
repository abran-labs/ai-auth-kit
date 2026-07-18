import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface Options { readonly roots: readonly string[]; readonly maximum: number; }

function parse(args: readonly string[]): Options {
	const maxIndex = args.indexOf("--max");
	if (maxIndex < 0 || !args[maxIndex + 1] || !/^\d+$/.test(args[maxIndex + 1])) throw new Error("Usage: bun run scripts/check-loc.ts <dir...> --max <lines>");
	const roots = args.slice(0, maxIndex);
	if (roots.length === 0) throw new Error("At least one directory is required");
	return { roots, maximum: Number(args[maxIndex + 1]) };
}

async function files(root: string): Promise<readonly string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const path = join(root, entry.name);
		if (entry.isDirectory()) return files(path);
		return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
	}));
	return nested.flat();
}

function lines(source: string): number {
	return source.split("\n").filter((line) => {
		const trimmed = line.trim();
		return trimmed.length > 0 && !trimmed.startsWith("//");
	}).length;
}

function isPureDataTable(source: string): boolean {
	return /^import type .+;\s+export const [A-Z][A-Z0-9_]*: readonly .+\[\] = \[/s.test(source);
}

const options = parse(process.argv.slice(2));
const violations: string[] = [];
for (const file of await Promise.all(options.roots.map(files)).then((groups) => groups.flat())) {
	const source = await readFile(file, "utf8");
	if (isPureDataTable(source)) continue;
	const count = lines(source);
	if (count > options.maximum) violations.push(`${file}: ${count} > ${options.maximum}`);
}
if (violations.length > 0) throw new Error(`LOC limit exceeded:\n${violations.join("\n")}`);
console.log(`LOC ok: <= ${options.maximum}`);
