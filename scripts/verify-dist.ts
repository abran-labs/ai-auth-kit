import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

type DistVerification = { readonly files: number };

async function filesAt(root: string, directory = ""): Promise<readonly string[]> {
  const location = join(root, directory);
  const entries = await readdir(location, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const next = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesAt(root, next)));
    if (entry.isFile()) files.push(next);
  }
  return files.sort();
}

async function compareDirectories(expected: string, actual: string): Promise<DistVerification> {
  const expectedFiles = await filesAt(expected);
  const actualFiles = await filesAt(actual);
  if (expectedFiles.join("\n") !== actualFiles.join("\n")) {
    throw new Error(`dist file inventory mismatch: expected ${expectedFiles.join(", ")}; rebuilt ${actualFiles.join(", ")}`);
  }
  for (const file of expectedFiles) {
    const [expectedBytes, actualBytes] = await Promise.all([readFile(join(expected, file)), readFile(join(actual, file))]);
    if (!expectedBytes.equals(actualBytes)) throw new Error(`dist byte mismatch: ${relative(expected, join(expected, file))}`);
  }
  return { files: expectedFiles.length };
}

export async function verifyDist(root: string): Promise<DistVerification> {
  const distribution = join(root, "dist");
  await access(join(distribution, "index.js"));
  await access(join(distribution, "index.d.ts"));
  await access(join(distribution, "cli.js"));
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "ai-auth-kit-dist-"));
  try {
    const rebuilt = join(temporaryDirectory, "dist");
    const compiler = join(root, "node_modules", ".bin", "tsc");
    const process = Bun.spawn({ cmd: [compiler, "-p", "tsconfig.json", "--outDir", rebuilt], cwd: root, stdout: "pipe", stderr: "pipe" });
    const output = `${await new Response(process.stdout).text()}${await new Response(process.stderr).text()}`;
    if ((await process.exited) !== 0) throw new Error(`dist rebuild failed: ${output}`);
    return await compareDirectories(distribution, rebuilt);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

if (import.meta.main) {
  const result = await verifyDist(process.cwd());
  process.stdout.write(`dist freshness ok (${result.files} files)\n`);
}
