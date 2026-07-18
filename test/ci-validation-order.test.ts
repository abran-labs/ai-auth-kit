import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "bun:test";
import { assertInstallerCurrent } from "../scripts/build-installer.js";
import { buildLinuxRelease } from "../scripts/release-build.js";

const root = resolve(import.meta.dirname, "..");

type WorkflowStep = { readonly name: string; readonly run: string };

function workflowSteps(workflow: string, job: string): readonly WorkflowStep[] {
  const jobHeader = `  ${job}:\n`;
  const start = workflow.indexOf(jobHeader);
  if (start < 0) throw new Error(`workflow job is missing: ${job}`);
  const section = workflow.slice(start + jobHeader.length).split(/^  [a-z][a-z-]*:$/m)[0] ?? "";
  const steps: WorkflowStep[] = [];
  const lines = section.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const named = /^      - name: (.+)$/.exec(line);
    if (named === null) continue;
    const run = lines[index + 1] ?? "";
    if (run !== "        run: |") continue;
    const command: string[] = [];
    for (index += 2; index < lines.length; index += 1) {
      const commandLine = lines[index] ?? "";
      if (!commandLine.startsWith("          ")) break;
      command.push(commandLine.trim());
    }
    steps.push({ name: named[1] ?? "", run: command.join("\n") });
  }
  return steps;
}

function expectSourceInstallerValidation(steps: readonly WorkflowStep[], name: string, releaseBuild: string): void {
  const step = steps.find((candidate) => candidate.name === name);
  if (step === undefined) throw new Error(`workflow step is missing: ${name}`);
  const commands = step.run.split("\n");
  expect(commands.slice(0, 4)).toEqual(["set -eu", "test ! -e release", releaseBuild, "bun run installer:check"]);
}

test("Given source-only validation workflows, when installer inputs are prepared, then generated artifacts cannot overwrite committed pins", async () => {
  // Given
  const [ci, release] = await Promise.all([
    readFile(join(root, ".github", "workflows", "ci.yml"), "utf8"),
    readFile(join(root, ".github", "workflows", "release.yml"), "utf8"),
  ]);

  // When
  const ciSteps = workflowSteps(ci, "validate");
  const releaseSteps = workflowSteps(release, "build");

  // Then
  expectSourceInstallerValidation(ciSteps, "Validate source installer against generated release", "bun run release:build --no-write-installer");
  expectSourceInstallerValidation(releaseSteps, "Build exact release bytes", 'bun run release:build --no-write-installer --release-version "${{ inputs.release_tag }}"');
});

test("Given generated release output and stale committed installer bytes, when installer integrity is checked, then validation fails without replacing source pins", async () => {
  // Given
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-installer-integrity-"));
  const releaseDirectory = join(directory, "release");
  const manifestPath = join(releaseDirectory, "manifest.json");
  const installerPath = join(directory, "install.sh");
  const sourceInstaller = await readFile(join(root, "install.sh"), "utf8");
  try {
    await buildLinuxRelease({ outputDirectory: releaseDirectory, sourceCommit: "a".repeat(40), writeInstaller: false });
    await writeFile(installerPath, "stale installer pins\n");

    // When
    // Then
    expect(await readFile(join(root, "install.sh"), "utf8")).toBe(sourceInstaller);
    let integrityError: unknown;
    try {
      await assertInstallerCurrent(manifestPath, installerPath);
    } catch (error) {
      integrityError = error;
    }
    if (!(integrityError instanceof Error)) throw new Error("stale installer check did not fail");
    expect(integrityError.message).toContain("install.sh is stale");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

test("Given the human README, when publication status is described, then source install is clear without release internals", async () => {
  // Given
  const readme = await readFile(join(root, "README.md"), "utf8");

  // When
  const claims = readme;

  // Then
  expect(claims).toContain("adcb364fa086ec1a854d2b412a5efbd530595b98");
  expect(claims).toMatch(/no verified public\s+release/);
  expect(claims).not.toContain("--attestation-receipt");
  expect(claims).not.toContain("manager-local-lifecycle");
});

test("Given public tracked text, when identity hygiene runs, then no retired project identity remains", async () => {
  // Given
  const listed = Bun.spawnSync(["git", "ls-files", "-co", "--exclude-standard"], {
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (listed.exitCode !== 0) throw new Error(listed.stderr.toString());
  const textExtensions = new Set([
    ".astro", ".css", ".html", ".js", ".json", ".jsonc", ".md", ".mjs", ".rs", ".sh",
    ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
  ]);
  const paths = listed.stdout
    .toString()
    .split("\n")
    .filter((path) => textExtensions.has(path.slice(path.lastIndexOf("."))));

  // When
  const retiredIdentity = String.fromCodePoint(118, 111, 120, 116, 121, 112, 101);
  const matches: string[] = [];
  for (const path of paths) {
    const source = await readFile(join(root, path), "utf8");
    if (source.toLowerCase().includes(retiredIdentity)) matches.push(path);
  }

  // Then
  expect(matches).toEqual([]);
});
