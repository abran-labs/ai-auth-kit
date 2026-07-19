import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const releaseVersion = "1.0.0";
const skillRoot = "skills/ai-auth-kit";
const releaseRoot = `release/agent-skill-v${releaseVersion}`;
const archiveName = `ai-auth-kit-skill-${releaseVersion}.tar.gz`;
const payloadPaths = [
  "SKILL.md",
  "VERSION",
  "scripts/check-library-version.mjs",
  "references/api.md",
  "references/auth-and-models.md",
  "references/host-patterns.md",
  "references/security.md",
] as const;

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function run(command: readonly string[]): Promise<void> {
  const child = Bun.spawn({ cmd: [...command], stderr: "pipe", stdout: "pipe" });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed: ${stderr}`);
}

async function payloadManifest(): Promise<string> {
  const entries = await Promise.all(payloadPaths.map(async (path) => `${digest(await Bun.file(join(skillRoot, path)).bytes())}  ${path}`));
  return `${entries.join("\n")}\n`;
}

async function expectedManifest(payload: string, archive: string): Promise<string> {
  return [
    `version=${releaseVersion}`,
    `archive=${archiveName}`,
    `archive_sha256=${digest(await Bun.file(archive).bytes())}`,
    "payload:",
    payload.trimEnd(),
    "",
  ].join("\n");
}

async function generate(): Promise<void> {
  const payload = await payloadManifest();
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(join(skillRoot, "PAYLOAD.sha256"), payload);
  const archive = join(releaseRoot, archiveName);
  await rm(archive, { force: true });
  await run(["tar", "--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", archive, "-C", "skills", "ai-auth-kit"]);
  await writeFile(join(releaseRoot, "manifest.txt"), await expectedManifest(payload, archive));
}

async function verify(): Promise<void> {
  const payload = await payloadManifest();
  const archive = join(releaseRoot, archiveName);
  const [actualPayload, actualManifest] = await Promise.all([
    readFile(join(skillRoot, "PAYLOAD.sha256"), "utf8"),
    readFile(join(releaseRoot, "manifest.txt"), "utf8"),
  ]);
  if (actualPayload !== payload || actualManifest !== await expectedManifest(payload, archive)) {
    throw new Error("Agent skill release artifacts are stale");
  }
  const listing = await Bun.$`tar -tzf ${archive}`.text();
  const expected = ["ai-auth-kit/", "ai-auth-kit/PAYLOAD.sha256", "ai-auth-kit/references/", "ai-auth-kit/scripts/", ...payloadPaths.map((path) => `ai-auth-kit/${path}`)].sort();
  if (listing.trimEnd().split("\n").sort().join("\n") !== expected.join("\n")) throw new Error(`unexpected archive inventory: ${basename(archive)}`);
}

if (import.meta.main) {
  if (Bun.argv[2] === "--check") {
    await verify();
    process.stdout.write("Agent skill release artifacts verified\n");
  } else {
    await generate();
    process.stdout.write("Agent skill release artifacts generated\n");
  }
}
