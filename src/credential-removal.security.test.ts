import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { createProjectAuthKit } from "./kit.js";

async function inSandbox(action: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-removal-security-"));
  try {
    await action(root);
  } finally {
    delete process.env.AI_AUTH_KIT_INTERRUPT_AT;
    await rm(root, { force: true, recursive: true });
  }
}

test("Given SIGKILL after a committed state removal, when a fresh process reads state, then it keeps valid state and reconciles the orphan secret", async () => {
  await inSandbox(async (root) => {
    const kit = createProjectAuthKit("kill", { rootDir: root });
    await kit.saveApiKey("openai", "kill-secret");
    const child = Bun.spawn({
      cmd: [process.execPath, "--bun", "-e", `
        import { createProjectAuthKit } from ${JSON.stringify(`${process.cwd()}/src/kit.ts`)};
        process.env.AI_AUTH_KIT_INTERRUPT_AT = "state-commit-sigkill";
        await createProjectAuthKit("kill", { rootDir: ${JSON.stringify(root)} }).removeCredential("openai");
      `],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await child.exited).not.toBe(0);

    expect((await kit.readState()).credentials.openai).toBeUndefined();
    expect(await kit.secrets.get("provider:openai:api-key")).toBeUndefined();
  });
});
