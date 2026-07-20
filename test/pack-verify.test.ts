import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { integrity, validateIntegrity, validateInventory, validateManifest, verifyPack, verifyPackedConsumers } from "../scripts/pack-verify.js";

const root = process.cwd();

async function verifyModifiedCatalog(change: (workspace: string) => Promise<void>): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-provenance-"));
  const workspace = join(temporary, "package");
  try {
    for (const entry of ["LICENSE", "README.md", "bun.lock", "dist", "generated", "package.json", "scripts", "src", "tsconfig.json"]) {
      await cp(join(root, entry), join(workspace, entry), { recursive: true });
    }
    await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "dir");
    await change(workspace);
    await verifyPack(workspace);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

async function run(command: readonly string[], cwd: string): Promise<number> {
  const processResult = Bun.spawn({ cmd: [...command], cwd, stderr: "pipe", stdout: "pipe" });
  return await processResult.exited;
}

async function frozenLocalInstallAcceptsTamperedTarball(tarball: string): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-frozen-local-tarball-"));
  try {
    await Bun.write(join(temporary, "package.tgz"), Bun.file(tarball));
    const consumer = join(temporary, "consumer");
    await mkdir(consumer);
    await Bun.write(join(consumer, "package.json"), JSON.stringify({ dependencies: { "@abran-labs/ai-auth-kit": "file:../package.tgz" } }));
    expect(await run(["bun", "install", "--offline", "--ignore-scripts"], consumer)).toBe(0);
    const extraction = join(temporary, "extraction");
    await mkdir(extraction);
    expect(await run(["tar", "-xzf", join(temporary, "package.tgz"), "-C", extraction], temporary)).toBe(0);
    await writeFile(join(extraction, "package", "README.md"), `${await readFile(join(extraction, "package", "README.md"), "utf8")}tampered\n`);
    const replacement = join(temporary, "replacement.tgz");
    expect(await run(["tar", "-czf", replacement, "-C", extraction, "package"], temporary)).toBe(0);
    await rename(replacement, join(temporary, "package.tgz"));
    await rm(join(consumer, "node_modules", "@abran-labs", "ai-auth-kit"), { force: true, recursive: true });
    expect(await run(["bun", "install", "--offline", "--frozen-lockfile", "--ignore-scripts"], consumer)).toBe(0);
    await expect(verifyPackedConsumers(join(temporary, "package.tgz"), await Bun.file(tarball).bytes())).rejects.toThrow("tarball integrity mismatch");
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

test("Given malformed release metadata, when the pack contract is validated, then executable and lifecycle surfaces fail closed", async () => {
  expect(() => validateManifest({
    version: "1.0.0",
    bin: { kit: "./dist/cli.js" },
    exports: { ".": { bun: "./src/index.ts", import: "./dist/index.js", types: "./dist/index.d.ts" } },
    files: [],
    publishConfig: { access: "public", registry: "https://registry.npmjs.org/" },
    scripts: {},
  })).toThrow();
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  expect(() => validateManifest({ ...manifest, scripts: { ...manifest.scripts, prepack: "node release.js" } })).toThrow("lifecycle script forbidden: prepack");
});

test("Given malformed packed payloads, when inventory and integrity are checked, then forbidden files, missing catalog, and tampering fail", () => {
  expect(() => validateInventory(["dist/cli.js"])).toThrow("tarball inventory mismatch");
  expect(() => validateInventory(["README.md", "LICENSE", "package.json"])).toThrow("tarball inventory mismatch");
  const original = integrity(new TextEncoder().encode("original"));
  const tampered = integrity(new TextEncoder().encode("tampered"));
  expect(tampered.sha256).not.toBe(original.sha256);
  expect(tampered.sri).not.toBe(original.sri);
  expect(() => validateIntegrity(new TextEncoder().encode("tampered"), original)).toThrow("tarball integrity mismatch");
});

test("Given a non-JSON provenance sidecar, when packing, then the release fails before creating a trusted tarball", async () => {
  await expect(verifyModifiedCatalog((workspace) => writeFile(join(workspace, "generated", "catalog-provenance.json"), "not-json\n"))).rejects.toThrow();
}, 30_000);

test("Given false generated provenance counts and hashes, when packing, then the release fails closed", async () => {
  await expect(verifyModifiedCatalog(async (workspace) => {
    const provenance = JSON.parse(await readFile(join(workspace, "generated", "catalog-provenance.json"), "utf8"));
    await writeFile(join(workspace, "generated", "catalog-provenance.json"), `${JSON.stringify({ ...provenance, normalizedContentSha256: "0".repeat(64), providerCount: 1, modelCount: 1 })}\n`);
  })).rejects.toThrow();
}, 30_000);

test("Given a valid JSON snapshot with tampered content, when packing, then the release fails its normalized catalog hash", async () => {
  await expect(verifyModifiedCatalog(async (workspace) => {
    const snapshot = await readFile(join(workspace, "generated", "catalog-snapshot.json"), "utf8");
    await writeFile(join(workspace, "generated", "catalog-snapshot.json"), snapshot.replace('"name":"302.AI"', '"name":"302.BI"'));
  })).rejects.toThrow();
}, 30_000);

test("Given a valid archive replaced at the same local path, when Bun frozen install accepts it, then explicit consumer SRI validation rejects its bytes", async () => {
  const result = await verifyPack(root);
  await frozenLocalInstallAcceptsTamperedTarball(result.tarball);
}, 30_000);

test("Given a fresh exact packed tarball, when Bun, Node ESM, and TypeScript consumers import its root, then the generated catalog is available", async () => {
  const result = await verifyPack(root);
  const evidence = join(root, ".omo", "evidence", "packed-library-consumer-verification");

  expect(result.inventory).toContain("generated/catalog-snapshot.json");
  expect(result.inventory).toContain("dist/index.js");
  expect(result.inventory).toContain("src/index.ts");
  expect(result.inventory.every((path) => !/(?:^|\/)cli(?:\.|\/|$)/.test(path))).toBeTrue();
  await access(result.tarball);
  await access(join(evidence, "consumer-bun.stdout.txt"));
  await access(join(evidence, "consumer-node.stdout.txt"));
  await access(join(evidence, "consumer-types.stdout.txt"));
  const [environment, lock, resolved] = await Promise.all([
    readFile(join(evidence, "consumer-environment.txt"), "utf8"),
    readFile(join(evidence, "consumer-lock.txt"), "utf8"),
    readFile(join(evidence, "consumer-resolved-path.txt"), "utf8"),
  ]);
  expect(lock).toContain("file:../package.tgz");
  expect(lock).toContain(result.sri);
  expect(environment).toContain("BUN_INSTALL_CACHE_DIR");
  expect(resolved).toContain("node_modules/@abran-labs/ai-auth-kit");
  expect(resolved).not.toContain(root);
}, 30_000);
