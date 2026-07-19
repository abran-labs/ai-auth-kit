import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();

test("Given an archive with an unreviewed payload file, when the curl installer validates its inventory, then it rejects it before installation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-skill-attack-"));
  try {
    const release = join(directory, "release");
    const extraction = join(directory, "extraction");
    const archive = join(release, "ai-auth-kit-skill-1.0.0.tar.gz");
    await cp(join(root, "release", "agent-skill-v1.0.0"), release, { recursive: true });
    await mkdir(extraction);
    await Bun.$`tar -xzf ${archive} -C ${extraction}`;
    await writeFile(join(extraction, "ai-auth-kit", "unreviewed.txt"), "unsafe\n");
    await Bun.$`tar -czf ${archive} -C ${extraction} ai-auth-kit`;
    const hash = new Bun.CryptoHasher("sha256");
    hash.update(await Bun.file(archive).bytes());
    const manifest = await readFile(join(release, "manifest.txt"), "utf8");
    await writeFile(join(release, "manifest.txt"), manifest.replace(/archive_sha256=.*/, `archive_sha256=${hash.digest("hex")}`));
    const result = Bun.spawn({
      cmd: ["sh", "scripts/install-agent-skill.sh"],
      cwd: root,
      env: { ...process.env, AI_AUTH_KIT_SKILL_RELEASE_BASE_URL: `file://${release}`, HOME: join(directory, "home") },
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("archive inventory mismatch");
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
