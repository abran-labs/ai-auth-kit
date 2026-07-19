import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { z } from "zod";
import { verifyDist } from "../scripts/verify-dist.js";

const root = process.cwd();
const packageManifestSchema = z.object({
  bin: z.never().optional(),
  exports: z.object({ ".": z.object({ bun: z.literal("./src/index.ts"), import: z.literal("./dist/index.js"), types: z.literal("./dist/index.d.ts") }).strict() }).strict(),
  files: z.array(z.string()),
  publishConfig: z.object({ access: z.literal("public"), registry: z.literal("https://registry.npmjs.org/") }).strict(),
  repository: z.object({ type: z.string(), url: z.string() }),
  scripts: z.record(z.string(), z.string()),
  version: z.literal("1.0.0"),
});

test("Given the canonical manifest, when package entry points are inspected, then consumers receive a public 1.0.0 root-only library without an executable bin", async () => {
  const manifest = packageManifestSchema.parse(JSON.parse(await readFile(join(root, "package.json"), "utf8")));

  expect(manifest.exports["."].bun).toBe("./src/index.ts");
  expect(manifest.exports["."].import).toBe("./dist/index.js");
  expect(manifest.exports["."].types).toBe("./dist/index.d.ts");
  expect(manifest.publishConfig).toEqual({ access: "public", registry: "https://registry.npmjs.org/" });
  expect(manifest.version).toBe("1.0.0");
  expect(manifest.bin).toBeUndefined();
  expect(manifest.files).toEqual([
    "dist",
    "src/account-oauth-browser.ts",
    "src/account-oauth-github.ts",
    "src/account-oauth-openai.ts",
    "src/account-oauth-shared.ts",
    "src/account-oauth.ts",
    "src/atomic-file.ts",
    "src/auth-policy-registry.ts",
    "src/catalog-adapter.ts",
    "src/catalog-cache.ts",
    "src/catalog-http.ts",
    "src/catalog-normalize.ts",
    "src/catalog-refresh.ts",
    "src/catalog-runtime.ts",
    "src/catalog-snapshot.ts",
    "src/catalog-source-schema.ts",
    "src/catalog.ts",
    "src/cliproxyapi-archive.ts",
    "src/cliproxyapi-cache.ts",
    "src/cliproxyapi-http.ts",
    "src/cliproxyapi-release.ts",
    "src/cliproxyapi.ts",
    "src/credential-removal.ts",
    "src/external-auth.ts",
    "src/index.ts",
    "src/kit-runtime-auth.ts",
    "src/kit.ts",
    "src/picker.ts",
    "src/safe-dir.ts",
    "src/schema.ts",
    "src/storage.ts",
    "src/types.ts",
    "generated/catalog-provenance.json",
    "generated/catalog-snapshot.json",
    "README.md",
    "LICENSE",
    "package.json",
  ]);
  expect(manifest.repository).toEqual({ type: "git", url: "https://github.com/abran-labs/ai-auth-kit.git" });
  for (const lifecycle of ["prepare", "prepack", "postinstall", "preinstall", "install"]) {
    expect(manifest.scripts[lifecycle]).toBeUndefined();
  }
  await access(join(root, "dist", "index.js"));
  await access(join(root, "dist", "index.d.ts"));
  await access(join(root, "dist", "index.js.map"));
  const ignored = Bun.spawn({ cmd: ["git", "check-ignore", "dist/index.js"], cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(await ignored.exited, `${await new Response(ignored.stdout).text()}${await new Response(ignored.stderr).text()}`).toBe(1);
});

test("Given generated distribution files, when their maps are inspected, then they are portable and deterministic", async () => {
  const map = await readFile(join(root, "dist", "index.js.map"), "utf8");
  expect(map).not.toContain(root);
  expect(map).not.toMatch(/20\d{2}-\d{2}-\d{2}T/);
});

test("Given the library-only distribution policy, when forbidden product paths are checked, then no generic executable or binary release surface remains", async () => {
  const forbiddenPaths = (await readFile(join(root, "test", "fixtures", "contracts", "library-only-forbidden-paths.txt"), "utf8"))
    .trim()
    .split("\n");

  for (const forbiddenPath of forbiddenPaths) {
    await expect(access(join(root, forbiddenPath))).rejects.toThrow();
  }
});

test("Given malformed package metadata, when library-only metadata is parsed, then missing root exports and executable bins fail closed", () => {
  expect(() => packageManifestSchema.parse({ files: [], repository: {}, scripts: {} })).toThrow();
  expect(() => packageManifestSchema.parse({
    bin: { "ai-auth-kit": "./dist/cli.js" },
    exports: { ".": {} },
    files: [],
    repository: { type: "git", url: "https://example.invalid/repo.git" },
    scripts: {},
  })).toThrow();
});

test("Given the expanded package payload, when Bun dry-runs packing, then root library entries remain and generic executable artifacts are absent", async () => {
  const processResult = Bun.spawn({
    cmd: ["bun", "pm", "pack", "--dry-run", "--ignore-scripts"],
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    processResult.exited,
    new Response(processResult.stderr).text(),
    new Response(processResult.stdout).text(),
  ]);
  const payloadPaths = stdout
    .split("\n")
    .flatMap((line) => {
      const match = /^packed\s+\S+\s+(.+)$/.exec(line);
      return match === null ? [] : [match[1] ?? ""];
    });

  expect(exitCode, stderr).toBe(0);
  expect(payloadPaths).toContain("dist/index.js");
  expect(payloadPaths).toContain("dist/index.d.ts");
  expect(payloadPaths).toContain("src/index.ts");
  expect(payloadPaths.some((path) => /(?:^|\/)(?:cli|version)(?:\.|\/|$)|(?:^|\/)install\.sh|(?:^|\/)installer-manager(?:\/|$)|(?:^|\/)release(?:\/|$)|(?:^|\/)\.npmrc$|(?:^|\/)(?:\.env|credentials)(?:\.|$)|\.(?:exe|dll|dylib|so|node)$/.test(path))).toBeFalse();
});

test("Given tracked distribution files, when source is rebuilt in a temporary directory, then every generated byte remains fresh", async () => {
  const result = await verifyDist(root);
  expect(result.files).toBeGreaterThan(0);
}, 20_000);

test("Given immutable-consumer documentation, when its dependency grammar is inspected, then it pins exact public npm version 1.0.0", async () => {
  const readme = await readFile(join(root, "README.md"), "utf8");
  expect(readme).toContain("bun add @abran-labs/ai-auth-kit@1.0.0");
  expect(readme).not.toContain("github:abran-labs/ai-auth-kit#");
  expect(readme).not.toMatch(/@abran-labs\/ai-auth-kit@(?:latest|\^|~|>=)/);
});
