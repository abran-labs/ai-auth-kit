import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { verifyPack } from "../scripts/pack-verify.js";

const root = process.cwd();
const registry = "https://registry.npmjs.org/";

async function inTemporaryDirectory<T>(action: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-npm-release-"));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function runPreflight(fixture: Readonly<Partial<Record<string, string>>>): Promise<{ readonly exitCode: number; readonly output: string }> {
  return await inTemporaryDirectory(async (directory) => {
    const tarballFilename = fixture.filename ?? "package.tgz";
    const tarball = join(directory, tarballFilename);
    const npm = join(directory, "npm");
    const inventory = join(directory, "pack.inventory.txt");
    if (fixture.sourceTarball === undefined) {
      const payload = join(directory, "payload", "package");
      await mkdir(payload, { recursive: true });
      await writeFile(join(payload, "README.md"), "trusted package bytes\n");
      await Bun.$`tar -czf ${tarball} -C ${join(directory, "payload")} package`;
      await writeFile(inventory, fixture.inventory === "drift" ? "drift\n" : "README.md\n");
    } else {
      await Bun.write(tarball, Bun.file(fixture.sourceTarball));
      const actualInventory = (await Bun.$`tar -tzf ${tarball}`.text())
        .split("\n")
        .flatMap((entry) => entry.startsWith("package/") && entry !== "package/" ? [entry.slice("package/".length)] : [])
        .sort()
        .join("\n");
      await writeFile(inventory, `${actualInventory}\n`);
    }
    const sha256 = await Bun.$`node -e 'const { createHash } = require("node:crypto"); const { readFileSync } = require("node:fs"); process.stdout.write(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"));' ${tarball}`.text();
    const sri = await Bun.$`node -e 'const { createHash } = require("node:crypto"); const { readFileSync } = require("node:fs"); process.stdout.write("sha512-" + createHash("sha512").update(readFileSync(process.argv[1])).digest("base64"));' ${tarball}`.text();
    await writeFile(npm, `#!/bin/sh\ncase "$*" in\n  "ping --registry=${registry}") if [ "${fixture.ping ?? "pong"}" = "wrong registry" ]; then exit 91; fi; printf '%s\\n' "${fixture.ping ?? "pong"}" ;;\n  whoami) if [ "${fixture.whoami ?? "release-bot"}" = "fail" ]; then printf '%s\\n' "OIDC has no token-backed principal" >&2; exit 92; fi; printf '%s\\n' "${fixture.whoami ?? "release-bot"}" ;;\n  "access ls-packages @abran-labs --json") printf '%s\\n' '${fixture.packages ?? '{"@abran-labs/ai-auth-kit":"write"}'}' ;;\n  "org ls abran-labs --json") printf '%s\\n' '${fixture.organization ?? '{"release-bot":"developer"}'}' ;;\n  "view @abran-labs/ai-auth-kit@1.0.0 version --registry=${registry} --json") printf '%s\\n' '${fixture.version ?? "null"}' ;;\n  "view @abran-labs/ai-auth-kit dist-tags --registry=${registry} --json") printf '%s\\n' '${fixture.tags ?? "{}"}' ;;\n  "publish --dry-run --access public $TARBALL") printf '%s\\n' "dry run accepted" ;;\n  *) printf 'unexpected npm invocation: %s\\n' "$*" >&2; exit 90 ;;\nesac\n`, { mode: 0o755 });
    const authentication = fixture.auth === "oidc" || fixture.auth === "dual" || fixture.auth === undefined
      ? {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fixture-token",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.invalid/request",
        NPM_CONFIG_PROVENANCE: fixture.provenance === "missing" ? "" : "true",
      }
      : {};
    const environment = {
      ...process.env,
      ...authentication,
      NODE_AUTH_TOKEN: fixture.auth === "token" || fixture.auth === "dual" ? "fixture-token" : "",
      GITHUB_REPOSITORY: fixture.repository ?? "abran-labs/ai-auth-kit",
      GITHUB_WORKFLOW_REF: fixture.workflow ?? "abran-labs/ai-auth-kit/.github/workflows/npm-release.yml@refs/heads/master",
      GITHUB_JOB: fixture.job ?? "publish",
      RELEASE_GITHUB_ENVIRONMENT: fixture.environment ?? "npm-production",
      NPM_CONFIG_REGISTRY: fixture.registry ?? registry,
      LC_ALL: fixture.locale ?? process.env.LC_ALL ?? "",
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      RELEASE_SOURCE_TAG_SHA: "a".repeat(40),
      RELEASE_TARBALL: tarball,
      RELEASE_TARBALL_FILENAME: tarballFilename,
      RELEASE_TARBALL_INVENTORY: fixture.inventory === "missing" ? join(directory, "missing.txt") : inventory,
      RELEASE_TARBALL_SHA256: `${fixture.sha256 ?? sha256.trim()}  ${tarballFilename}`,
      RELEASE_TARBALL_SRI: fixture.sri ?? sri.trim(),
      TARBALL: tarball,
    };
    const processResult = Bun.spawn({ cmd: ["sh", "scripts/npm-preflight.sh"], cwd: root, env: environment, stderr: "pipe", stdout: "pipe" });
    const [exitCode, stdout, stderr] = await Promise.all([processResult.exited, new Response(processResult.stdout).text(), new Response(processResult.stderr).text()]);
    return { exitCode, output: `${stdout}${stderr}` };
  });
}

test("Given the npm release workflow, when its publication contract is inspected, then it creates and publishes one verified tagged tarball only after a fresh approval", async () => {
  const workflow = await readFile(join(root, ".github", "workflows", "npm-release.yml"), "utf8");

  expect(workflow).toContain("tags:");
  expect(workflow).toContain("source_tag");
  expect(workflow).toContain("I_HAVE_EXPLICIT_FINAL_NPM_APPROVAL");
  expect(workflow).toContain("environment: npm-production");
  expect(workflow).toContain("bun install --frozen-lockfile");
  expect(workflow).toContain("bun run pack:verify");
  expect(workflow).toContain("source-tag.sha");
  expect(workflow).toContain("pack.sha256");
  expect(workflow).toContain("pack.sri");
  expect(workflow).toContain("pack.inventory.txt");
  expect(workflow).toContain("actions/upload-artifact@");
  expect(workflow).toContain("actions/download-artifact@");
  expect(workflow).toContain("ref: ${{ needs.package.outputs.source_tag_sha }}");
  expect(workflow).toContain("git rev-parse HEAD");
  expect(workflow).toContain("oven-sh/setup-bun@");
  expect(workflow).toContain("INPUT_SOURCE_TAG");
  expect(workflow).toContain("RELEASE_TARBALL_FILENAME");
  expect(workflow).toContain("RELEASE_GITHUB_ENVIRONMENT: npm-production");
  expect(workflow).toContain("npm publish \"$RELEASE_TARBALL\"");
  expect(workflow).not.toMatch(/npm publish\s+(?:\.|\$\{?GITHUB_WORKSPACE)/);
  expect(workflow).not.toContain("bun pm pack");
  expect(workflow).not.toContain("softprops/action-gh-release");
});

test("Given GitHub OIDC trusted publishing, when npm whoami has no token-backed principal, then preflight accepts the exact verified tarball", async () => {
  const oidcWithoutTokenPrincipal = await runPreflight({ whoami: "fail" });
  expect(oidcWithoutTokenPrincipal.exitCode, oidcWithoutTokenPrincipal.output).toBe(0);
  expect(oidcWithoutTokenPrincipal.output).toContain("GitHub OIDC context");
});

test("Given GitHub OIDC trusted publishing, when a token is also present, then preflight rejects ambiguous authentication", async () => {
  const result = await runPreflight({ auth: "dual" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given GitHub OIDC trusted publishing, when its GitHub repository context is wrong, then preflight rejects it", async () => {
  const result = await runPreflight({ repository: "other-owner/other-repo" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given GitHub OIDC trusted publishing, when its workflow context is wrong, then preflight rejects it", async () => {
  const result = await runPreflight({ workflow: "abran-labs/ai-auth-kit/.github/workflows/other.yml@refs/heads/master" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given GitHub OIDC trusted publishing, when its job context is wrong, then preflight rejects it", async () => {
  const result = await runPreflight({ job: "package" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given GitHub OIDC trusted publishing, when its environment context is wrong, then preflight rejects it", async () => {
  const result = await runPreflight({ environment: "staging" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given GitHub OIDC trusted publishing, when provenance is missing, then preflight rejects it", async () => {
  const result = await runPreflight({ provenance: "missing" });
  expect(result.exitCode, result.output).not.toBe(0);
});

test("Given release preflight fixtures, when registry, principal, authority, availability, auth path, and artifact integrity are invalid, then every ambiguous state fails closed", async () => {
  const baseline = await runPreflight({});
  expect(baseline.exitCode, baseline.output).toBe(0);
  const uploadedArtifact = await runPreflight({ filename: "abran-labs-ai-auth-kit-1.0.0.tgz" });
  expect(uploadedArtifact.exitCode, uploadedArtifact.output).toBe(0);
  for (const locale of ["C", "en_US.UTF-8"] as const) {
    const localeArtifact = await runPreflight({ filename: "abran-labs-ai-auth-kit-1.0.0.tgz", locale });
    expect(localeArtifact.exitCode, localeArtifact.output).toBe(0);
  }
  const packed = await verifyPack(root);
  for (const locale of ["C", "en_US.UTF-8"] as const) {
    const actualArtifact = await runPreflight({ filename: "abran-labs-ai-auth-kit-1.0.0.tgz", locale, sourceTarball: packed.tarball });
    expect(actualArtifact.exitCode, actualArtifact.output).toBe(0);
  }

  for (const fixture of [
    { registry: "https://registry.invalid/" },
    { whoami: "", auth: "token" },
    { packages: "{}", auth: "token" },
    { organization: "{}", auth: "token" },
    { version: '"1.0.0"' },
    { tags: '{"latest":"1.0.0"}' },
    { sha256: "0".repeat(64) },
    { sri: "sha512-invalid" },
    { inventory: "drift" },
    { auth: "missing" },
  ] as const satisfies readonly Partial<Record<string, string>>[]) {
    const result = await runPreflight(fixture);
    expect(result.exitCode, result.output).not.toBe(0);
  }
}, 30_000);

test("Given release preflight authentication, when neither GitHub OIDC nor a token is configured, then publication preparation fails without claiming authority", async () => {
  const script = await readFile(join(root, "scripts", "npm-preflight.sh"), "utf8");

  expect(script).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
  expect(script).toContain("NODE_AUTH_TOKEN");
  expect(script).toContain("npm ping --registry=https://registry.npmjs.org/");
  expect(script).toContain("npm whoami");
  expect(script).toContain("npm access ls-packages @abran-labs --json");
  expect(script).toContain("npm org ls abran-labs --json");
  expect(script).toContain("npm publish --dry-run --access public \"$RELEASE_TARBALL\"");
});
