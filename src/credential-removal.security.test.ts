import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { CHATGPT_HOST_ID_REF, isHostSecretRef, liveSecretRefs } from "./credential-removal.js";
import { createProjectAuthKit } from "./kit.js";
import type { AuthKitState } from "./types.js";

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

test("Given stored host and credential secrets, when live refs are collected, then host refs and id-token refs survive reconcile", async () => {
  const state: AuthKitState = {
    credentials: {
      openai: {
        type: "oauth-external",
        metadata: {
          adapter: "openai-chatgpt-plan",
          accessTokenRef: "provider:openai:oauth:access-token",
          refreshTokenRef: "provider:openai:oauth:refresh-token",
          idTokenRef: "provider:openai:oauth:id-token",
        },
        createdAt: "2026-10-08T00:00:00.000Z",
      },
    },
    updatedAt: "2026-10-08T00:00:00.000Z",
  };

  expect(isHostSecretRef(CHATGPT_HOST_ID_REF)).toBeTrue();
  expect(isHostSecretRef("provider:openai:oauth:access-token")).toBeFalse();
  expect(liveSecretRefs(state)).toEqual(expect.arrayContaining([
    "provider:openai:oauth:access-token",
    "provider:openai:oauth:refresh-token",
    "provider:openai:oauth:id-token",
    CHATGPT_HOST_ID_REF,
  ]));

  await inSandbox(async (root) => {
    const kit = createProjectAuthKit("host", { rootDir: root });
    await kit.secrets.set(CHATGPT_HOST_ID_REF, "urn:uuid:00000000-0000-4000-8000-000000000000");
    await kit.saveApiKey("openai", "host-secret");

    await kit.readState();

    expect(await kit.secrets.get(CHATGPT_HOST_ID_REF)).toBe("urn:uuid:00000000-0000-4000-8000-000000000000");
  });
});
