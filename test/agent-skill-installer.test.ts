import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();

test("Given the reviewed local skill release, when the curl installer runs in an isolated home, then it installs one canonical payload and Claude symlink", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-auth-kit-skill-home-"));
  try {
    const release = join(root, "release", "agent-skill-v1.0.0");
    const result = Bun.spawn({
      cmd: ["sh", "scripts/install-agent-skill.sh"],
      cwd: root,
      env: { ...process.env, AI_AUTH_KIT_SKILL_RELEASE_BASE_URL: `file://${release}`, HOME: home },
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);

    expect(exitCode, stderr).toBe(0);
    expect(await readFile(join(home, ".agents", "skills", "ai-auth-kit", "VERSION"), "utf8")).toBe("1.0.0\n");
    expect(await Bun.file(join(home, ".claude", "skills", "ai-auth-kit", "SKILL.md")).exists()).toBeTrue();
    expect(await Bun.file(join(home, ".config", "opencode", "skills", "ai-auth-kit", "SKILL.md")).exists()).toBeFalse();
  } finally {
    await rm(home, { force: true, recursive: true });
  }
});

test("Given an absent canonical target and a user-owned Claude target, when installation is rejected, then neither destination is mutated", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-auth-kit-skill-home-"));
  try {
    const claudeTarget = join(home, ".claude", "skills", "ai-auth-kit");
    await mkdir(claudeTarget, { recursive: true });
    await writeFile(join(claudeTarget, "owner-note.txt"), "preserve me\n");
    const release = join(root, "release", "agent-skill-v1.0.0");
    const result = Bun.spawn({
      cmd: ["sh", "scripts/install-agent-skill.sh"],
      cwd: root,
      env: { ...process.env, AI_AUTH_KIT_SKILL_RELEASE_BASE_URL: `file://${release}`, HOME: home },
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Claude target");
    expect(await Bun.file(join(home, ".agents", "skills", "ai-auth-kit", "SKILL.md")).exists()).toBeFalse();
    expect(await readFile(join(claudeTarget, "owner-note.txt"), "utf8")).toBe("preserve me\n");
  } finally {
    await rm(home, { force: true, recursive: true });
  }
});
