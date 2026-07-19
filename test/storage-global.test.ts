import { expect, test } from "bun:test";
import { createAuthKit, globalStorage } from "../src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Given opt-in global storage, when API-key CRUD completes, then secret state is isolated from project storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-storage-"));
  const configHome = join(root, "config");
  try {
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configHome;
    try {
      const kit = createAuthKit({ storage: globalStorage("global-storage-contract") });
      await kit.saveApiKey("openai", "global-secret");
      expect(await kit.getCredential("openai")).toMatchObject({ type: "api-key", secretRef: "provider:openai:api-key" });
      const globalSecretPath = kit.secrets.path;
      if (!globalSecretPath) throw new Error("Global storage requires a secrets path");
      expect(await Bun.file(globalSecretPath).text()).toContain("global-secret");

      await kit.removeCredential("openai");
      expect(await kit.getCredential("openai")).toBeUndefined();
      await expect(Bun.file(globalSecretPath).exists()).resolves.toBe(false);
    } finally {
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
