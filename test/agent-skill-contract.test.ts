import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import ts from "typescript";

const root = process.cwd();
const skillRoot = join(root, "skills", "ai-auth-kit");
const expectedVersion = "1.0.0";
const installCommand = "bun add @abran-labs/ai-auth-kit@1.0.0";
const skillReleaseSchema = z.object({
  archive: z.literal("ai-auth-kit-skill-1.0.0.tar.gz"),
  installer: z.literal("install-agent-skill.sh"),
  libraryPackage: z.literal("@abran-labs/ai-auth-kit"),
  libraryVersion: z.literal(expectedVersion),
  schemaVersion: z.literal(1),
  skill: z.literal("ai-auth-kit"),
  skillVersion: z.literal(expectedVersion),
}).strict();
const packageFixtureSchema = z.object({
  exports: z
    .object({
      ".": z
        .object({
          bun: z.string(),
          import: z.string(),
          types: z.string(),
        })
        .strict(),
    })
    .strict(),
});

async function runVersionCheck(version: string): Promise<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}> {
  const projectRoot = await mkdtemp(join(tmpdir(), "ai-auth-kit-version-"));
  const packageRoot = join(projectRoot, "node_modules", "@abran-labs", "ai-auth-kit");
  try {
    const realManifest = packageFixtureSchema.parse(
      JSON.parse(await Bun.file(join(root, "package.json")).text()),
    );
    await Promise.all([
      mkdir(join(packageRoot, "dist"), { recursive: true }),
      mkdir(join(packageRoot, "src"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(projectRoot, "package.json"), '{"type":"module"}\n'),
      writeFile(join(packageRoot, "dist", "index.js"), "export {};\n"),
      writeFile(join(packageRoot, "dist", "index.d.ts"), "export {};\n"),
      writeFile(join(packageRoot, "src", "index.ts"), "export {};\n"),
      writeFile(
        join(packageRoot, "package.json"),
        `${JSON.stringify({
          name: "@abran-labs/ai-auth-kit",
          version,
          type: "module",
          exports: realManifest.exports,
        })}\n`,
      ),
    ]);
    const processResult = Bun.spawn({
      cmd: [
        "node",
        join(skillRoot, "scripts", "check-library-version.mjs"),
        "--project-dir",
        projectRoot,
      ],
      cwd: projectRoot,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr, stdout] = await Promise.all([
      processResult.exited,
      new Response(processResult.stderr).text(),
      new Response(processResult.stdout).text(),
    ]);
    return { exitCode, stderr, stdout };
  } finally {
    await rm(projectRoot, { recursive: true });
  }
}

test("Given the versioned skill payload, when it is inspected, then it is complete and pins its own and library versions", async () => {
  const requiredPaths = [
    "SKILL.md",
    "VERSION",
    "PAYLOAD.sha256",
    "scripts/check-library-version.mjs",
    "references/api.md",
    "references/auth-and-models.md",
    "references/host-patterns.md",
    "references/security.md",
  ] as const;
  const existence = await Promise.all(
    requiredPaths.map((path) => Bun.file(join(skillRoot, path)).exists()),
  );
  expect(existence).toEqual(requiredPaths.map(() => true));
  expect((await Bun.file(join(skillRoot, "VERSION")).text()).trim()).toBe(expectedVersion);

  const skill = await Bun.file(join(skillRoot, "SKILL.md")).text();
  const checkerPosition = skill.indexOf("check-library-version.mjs");
  const workflowPosition = skill.indexOf("## Workflow");
  expect(checkerPosition).toBeGreaterThan(-1);
  expect(checkerPosition).toBeLessThan(workflowPosition);
  expect(skill).toContain("exactly 1.0.0");
  expect(skill).toContain("Do not continue");
});

test("Given the exact library version, when first-use validation runs, then it reports the resolved package and succeeds", async () => {
  const result = await runVersionCheck(expectedVersion);
  expect(result.exitCode, result.stderr).toBe(0);
  expect(result.stdout).toContain("expected=1.0.0");
  expect(result.stdout).toContain("detected=1.0.0");
  expect(result.stdout).toContain("path=");
  expect(result.stdout).toContain("upgrade=no-action-required");
});

test("Given the public root module, when the self-contained API reference is checked, then every export has an exact entry", async () => {
  const source = await Bun.file(join(root, "src", "index.ts")).text();
  const sourceFile = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
  const exports = sourceFile.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) return [];
    if (!ts.isNamedExports(statement.exportClause)) return [];
    return statement.exportClause.elements.map((element) => element.name.text);
  });
  const reference = await Bun.file(join(skillRoot, "references", "api.md")).text();

  expect(exports).toHaveLength(65);
  for (const exportedName of exports) expect(reference).toContain(`\`${exportedName}\``);
});

test("Given agent implementation guidance, when knowledge sources are ordered, then bundled skill references are primary and docs are fallback only", async () => {
  const [skill, quickstart, agentGuide] = await Promise.all([
    Bun.file(join(skillRoot, "SKILL.md")).text(),
    Bun.file(join(root, "docs-site/src/content/docs/start/quickstart.md")).text(),
    Bun.file(join(root, "docs-site/src/content/docs/guides/agent-skill.md")).text(),
  ]);
  for (const source of [skill, agentGuide]) {
    expect(source.toLowerCase()).toContain("primary knowledge");
    expect(source.toLowerCase()).toContain("docs are fallback only");
  }
  expect(quickstart).toMatch(
    /\[agent\s+skill\]\(\.\.\/\.\.\/guides\/agent-skill\/\)/i,
  );
  expect(quickstart.toLowerCase()).not.toContain("primary knowledge");
  expect(quickstart.toLowerCase()).not.toContain("docs are fallback only");
});

test("Given a mismatched library version, when first-use validation runs, then it stops with exact remediation", async () => {
  const result = await runVersionCheck("0.9.0");
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("expected=1.0.0");
  expect(result.stderr).toContain("detected=0.9.0");
  expect(result.stderr).toContain("path=");
  expect(result.stderr).toContain(`upgrade=${installCommand}`);
});

test("Given public human and agent documentation, when install guidance is scanned, then only the exact npm package is recommended", async () => {
  const paths = [
    "README.md",
    "docs-site/src/pages/index.astro",
    "docs-site/src/content/docs/start/index.md",
    "docs-site/src/content/docs/start/quickstart.md",
    "docs-site/src/content/docs/guides/agent-skill.md",
    "skills/ai-auth-kit/SKILL.md",
  ] as const;
  const source = (
    await Promise.all(paths.map((path) => Bun.file(join(root, path)).text()))
  ).join("\n");

  expect(source).toContain(installCommand);
  expect(source).not.toMatch(/@abran-labs\/ai-auth-kit@(?:latest|\^|~|>=|github:)/i);
  expect(source).not.toContain("github:abran-labs/ai-auth-kit#");
  expect(source).not.toMatch(/\bai-auth-kit\s+(?:init|login|models|providers|use|doctor)\b/i);
  expect(source).not.toMatch(/generic global executable/i);
});

test("Given staged npm-facing documentation, when its release policy is reviewed, then it requires exact versioning and a separate final approval", async () => {
  const checklist = await Bun.file(join(root, "docs", "npm-release-checklist.md")).text();
  for (const marker of [
    "package.json",
    "README.md",
    "docs-site",
    "skills/ai-auth-kit/VERSION",
    "check-library-version.mjs",
    "npm-release.yml",
    "I_HAVE_EXPLICIT_FINAL_NPM_APPROVAL",
    "npm-production",
    "Do not deploy",
  ] as const) {
    expect(checklist).toContain(marker);
  }
});

test("Given the curl-installed skill release, when its manifest and checklist are inspected, then exact versions and irreversible gates stay explicit", async () => {
  const [release, checklist] = await Promise.all([
    Bun.file(join(root, "agent-skill-release.json")).json(),
    Bun.file(join(root, "docs", "agent-skill-release-checklist.md")).text(),
  ]);
  expect(skillReleaseSchema.parse(release)).toMatchObject({ libraryVersion: expectedVersion, skillVersion: expectedVersion });
  expect(checklist).toContain("pack-agent-skill.ts --check");
  expect(checklist).toContain("Do not upload");
});
