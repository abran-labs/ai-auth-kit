import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();

test("Given the curl-installed agent skill, when canonical artifact verification runs, then its installer, manifest, and archive are current", async () => {
  const result = Bun.spawn({ cmd: ["bun", "run", "scripts/pack-agent-skill.ts", "--check"], cwd: root, stderr: "pipe", stdout: "pipe" });
  const [exitCode, stderr, stdout] = await Promise.all([result.exited, new Response(result.stderr).text(), new Response(result.stdout).text()]);

  expect(exitCode, `${stderr}${stdout}`).toBe(0);
  expect(stdout).toContain("Agent skill release artifacts verified");
  await access(join(root, "scripts", "install-agent-skill.sh"));
  expect(await readFile(join(root, "agent-skill-release.json"), "utf8")).toContain("install-agent-skill.sh");
});
