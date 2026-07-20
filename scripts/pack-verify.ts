import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { z } from "zod";
import { validateGeneratedCatalog, type CatalogVerification } from "./catalog-provenance.js";
import { verifyDist } from "./verify-dist.js";

const PACKAGE_NAME = "@abran-labs/ai-auth-kit";
const EVIDENCE_DIRECTORY = ".omo/evidence/packed-library-consumer-verification";
const GENERATED_CATALOG = ["generated/catalog-provenance.json", "generated/catalog-snapshot.json"] as const;
const ROOT_FILES = ["README.md", "LICENSE", "package.json"] as const;
const SOURCE_FILES = [
  "account-oauth-browser", "account-oauth-github", "account-oauth-openai", "account-oauth-shared", "account-oauth", "atomic-file",
  "auth-policy-registry", "catalog-adapter", "catalog-cache", "catalog-http", "catalog-normalize", "catalog-refresh", "catalog-runtime",
  "catalog-snapshot", "catalog-source-schema", "catalog", "cliproxyapi-archive", "cliproxyapi-cache", "cliproxyapi-http",
  "cliproxyapi-release", "cliproxyapi", "credential-removal", "external-auth", "index", "kit-runtime-auth", "kit", "picker",
  "safe-dir", "schema", "storage", "types",
] as const;
const DIST_FILES = [...SOURCE_FILES, "catalog-index"] as const;
const LIFECYCLE_SCRIPTS = ["prepare", "prepack", "postpack", "preinstall", "install", "postinstall"] as const;

const packageSchema = z.object({
  bin: z.never().optional(),
  exports: z.object({ ".": z.object({ bun: z.literal("./src/index.ts"), import: z.literal("./dist/index.js"), types: z.literal("./dist/index.d.ts") }).strict() }).strict(),
  files: z.array(z.string()),
  publishConfig: z.object({ access: z.literal("public"), registry: z.literal("https://registry.npmjs.org/") }).strict(),
  scripts: z.record(z.string(), z.string()),
  version: z.literal("1.0.0"),
});

export type PackVerification = {
  readonly inventory: readonly string[];
  readonly sha256: string;
  readonly sri: string;
  readonly tarball: string;
};

class PackContractError extends Error {
  readonly name = "PackContractError";
}

async function run(command: readonly string[], cwd: string, env?: Readonly<Record<string, string>>): Promise<string> {
  const child = Bun.spawn({ cmd: [...command], cwd, env, stdout: "pipe", stderr: "pipe" });
  const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (status !== 0) throw new PackContractError(`${command.join(" ")} failed: ${stderr}${stdout}`);
  return stdout;
}

function expectedInventory(): readonly string[] {
  return [
    ...ROOT_FILES,
    ...GENERATED_CATALOG,
    ...SOURCE_FILES.map((file) => `src/${file}.ts`),
    ...DIST_FILES.flatMap((file) => [`dist/${file}.d.ts`, `dist/${file}.js`, `dist/${file}.js.map`]),
  ].sort();
}

export function validateManifest(value: unknown): void {
  const manifest = packageSchema.parse(value);
  const expectedFiles = [
    "dist",
    ...SOURCE_FILES.map((file) => `src/${file}.ts`),
    ...GENERATED_CATALOG,
    ...ROOT_FILES,
  ];
  if (manifest.files.join("\n") !== expectedFiles.join("\n")) throw new PackContractError("package files allowlist changed");
  for (const lifecycle of LIFECYCLE_SCRIPTS) {
    if (manifest.scripts[lifecycle] !== undefined) throw new PackContractError(`lifecycle script forbidden: ${lifecycle}`);
  }
}

export function validateInventory(inventory: readonly string[]): void {
  const actual = [...inventory].sort();
  const expected = expectedInventory();
  if (actual.join("\n") !== expected.join("\n")) throw new PackContractError(`tarball inventory mismatch: ${actual.join(", ")}`);
  if (actual.some((path) => /(?:^|\/)(?:cli|version)(?:\.|\/|$)|(?:^|\/)install\.sh|(?:^|\/)installer-manager(?:\/|$)|(?:^|\/)release(?:\/|$)|(?:^|\/)\.npmrc$|(?:^|\/)(?:credentials|\.env)(?:\.|$)|\.(?:exe|dll|dylib|so|node)$/.test(path))) {
    throw new PackContractError("forbidden payload path");
  }
}

export function integrity(bytes: Uint8Array): { readonly sha256: string; readonly sri: string } {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sri: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  };
}

export function validateIntegrity(bytes: Uint8Array, expected: { readonly sha256: string; readonly sri: string }): void {
  const actual = integrity(bytes);
  if (actual.sha256 !== expected.sha256 || actual.sri !== expected.sri) throw new PackContractError("tarball integrity mismatch");
}

async function extractInventory(tarball: string, root: string): Promise<readonly string[]> {
  const output = await run(["tar", "-tzf", tarball], root);
  return output.trim().split("\n").map((entry) => {
    if (!entry.startsWith("package/")) throw new PackContractError(`invalid tarball entry: ${entry}`);
    return entry.slice("package/".length);
  });
}

async function validatePackedCatalog(tarball: string): Promise<CatalogVerification> {
  const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-packed-catalog-"));
  try {
    await run(["tar", "-xzf", tarball, "-C", temporary], temporary);
    return await validateGeneratedCatalog(join(temporary, "package"), false);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

async function writeConsumer(directory: string): Promise<void> {
  await writeFile(join(directory, "package.json"), JSON.stringify({ type: "module", dependencies: { [PACKAGE_NAME]: "file:../package.tgz" }, devDependencies: { "@types/node": "^25.0.1", typescript: "^5.9.3" } }, null, 2));
  await writeFile(join(directory, "consumer.mjs"), `import { DEFAULT_PROVIDERS } from "${PACKAGE_NAME}";\nif (DEFAULT_PROVIDERS.length === 0) throw new Error("catalog unavailable");\nconsole.log(\`catalog=\${DEFAULT_PROVIDERS.length}\`);\n`);
  await writeFile(join(directory, "consumer.ts"), `import { DEFAULT_PROVIDERS } from "${PACKAGE_NAME}";\nconst providers: readonly { readonly id: string }[] = DEFAULT_PROVIDERS;\nif (providers.length === 0) throw new Error("catalog unavailable");\nconsole.log(\`catalog=\${providers.length}\`);\n`);
  await writeFile(join(directory, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", noEmit: true, strict: true, target: "ES2022", types: ["node"] }, include: ["consumer.ts"] }, null, 2));
}

export async function verifyPackedConsumers(tarball: string, approvedBytes: Uint8Array): Promise<{ readonly bun: string; readonly lock: string; readonly node: string; readonly resolved: string; readonly types: string }> {
  const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-packed-consumer-"));
  try {
    const approved = integrity(approvedBytes);
    const candidate = await Bun.file(tarball).bytes();
    validateIntegrity(candidate, approved);
    const packed = join(temporary, "package.tgz");
    await Bun.write(packed, candidate);
    const consumer = join(temporary, "consumer");
    await mkdir(consumer);
    await writeConsumer(consumer);
    const environment = {
      BUN_INSTALL_CACHE_DIR: join(temporary, "bun-cache"),
      HOME: process.env.HOME ?? temporary,
      NO_PROXY: process.env.NO_PROXY ?? "",
      PATH: process.env.PATH ?? "",
      TMPDIR: temporary,
    };
    validateIntegrity(await Bun.file(packed).bytes(), approved);
    await run(["bun", "install", "--offline", "--ignore-scripts"], consumer, environment);
    const lock = await readFile(join(consumer, "bun.lock"), "utf8");
    if (!lock.includes("file:../package.tgz") || !lock.includes(approved.sri)) throw new PackContractError("consumer lock does not pin local tarball SRI");
    const resolved = await realpath(join(consumer, "node_modules", "@abran-labs", "ai-auth-kit"));
    if (!resolved.startsWith(join(consumer, "node_modules"))) throw new PackContractError("consumer resolved package outside isolated node_modules");
    const node = await run(["node", "consumer.mjs"], consumer);
    const bun = await run(["bun", "consumer.ts"], consumer);
    const types = await run([join(consumer, "node_modules/.bin/tsc"), "-p", "tsconfig.json"], consumer);
    return { bun, lock, node, resolved, types };
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

export async function verifyPack(root: string): Promise<PackVerification> {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  validateManifest(manifest);
  await verifyDist(root);
  const catalog = await validateGeneratedCatalog(root, true);
  const evidence = join(root, EVIDENCE_DIRECTORY);
  await mkdir(evidence, { recursive: true });
  const tarball = join(evidence, "abran-labs-ai-auth-kit-1.0.0.tgz");
  await rm(tarball, { force: true });
  const dryRun = await run(["bun", "pm", "pack", "--dry-run", "--ignore-scripts"], root);
  await run(["bun", "pm", "pack", "--ignore-scripts", "--destination", evidence], root);
  await access(tarball);
  const inventory = await extractInventory(tarball, root);
  validateInventory(inventory);
  const packedCatalog = await validatePackedCatalog(tarball);
  if (JSON.stringify(catalog) !== JSON.stringify(packedCatalog)) throw new PackContractError("packed catalog validation differs from source catalog validation");
  const approvedTarball = await Bun.file(tarball).bytes();
  const digest = integrity(approvedTarball);
  const consumers = await verifyPackedConsumers(tarball, approvedTarball);
  await Promise.all([
    writeFile(join(evidence, "pack.inventory.txt"), `${[...inventory].sort().join("\n")}\n`),
    writeFile(join(evidence, "pack.sha256"), `${digest.sha256}  ${basename(tarball)}\n`),
    writeFile(join(evidence, "pack.sri"), `${digest.sri}\n`),
    writeFile(join(evidence, "consumer-bun.stdout.txt"), consumers.bun),
    writeFile(join(evidence, "consumer-node.stdout.txt"), consumers.node),
    writeFile(join(evidence, "consumer-types.stdout.txt"), consumers.types),
    writeFile(join(evidence, "consumer-lock.txt"), consumers.lock),
    writeFile(join(evidence, "consumer-resolved-path.txt"), `${consumers.resolved}\n`),
    writeFile(join(evidence, "consumer-environment.txt"), "BUN_INSTALL_CACHE_DIR\nHOME\nNO_PROXY\nPATH\nTMPDIR\n"),
    writeFile(join(evidence, "catalog-verification.json"), `${JSON.stringify({ source: catalog, tarball: packedCatalog }, null, 2)}\n`),
    writeFile(join(evidence, "package-payload.stdout.txt"), dryRun),
    writeFile(join(evidence, "commands-and-results.md"), [
      "# Local npm pack verification",
      "",
      "- `bun pm pack --dry-run --ignore-scripts`: passed",
      "- `bun pm pack --ignore-scripts --destination .omo/evidence/packed-library-consumer-verification`: passed",
      "- clean Bun source-condition consumer: passed",
      "- clean Node ESM built-condition consumer: passed",
      "- clean TypeScript declarations consumer: passed",
      "- consumer lock pins local tarball SRI and resolved path stays under isolated node_modules: passed",
      "- approved tarball bytes are re-hashed to SHA-512/SRI immediately before local file-tar install: passed",
      "- generated catalog provenance validated before packing and from extracted tarball bytes: passed",
      "",
      `SHA-256: ${digest.sha256}`,
      `SRI: ${digest.sri}`,
      `Catalog: ${catalog.providerCount} providers, ${catalog.modelCount} models`,
    ].join("\n").concat("\n")),
  ]);
  return { inventory: [...inventory].sort(), ...digest, tarball };
}

if (import.meta.main) {
  const result = await verifyPack(process.cwd());
  process.stdout.write(`pack verified ${result.sha256} ${result.sri}\n`);
}
