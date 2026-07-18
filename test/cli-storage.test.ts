import { expect, test } from "bun:test";
import { createAuthKit, globalStorage, projectStorage } from "../src/index.js";
import { inCliSandbox, pathExists, projectConfigPath, projectSecretsPath, runCli } from "./cli-test-helpers.js";

test("Given project storage behind the CLI, when library CRUD saves then removes an API key, then current/path remain observable and secret bytes are deleted", async () => {
  await inCliSandbox(async (sandbox) => {
    const kit = createAuthKit({ storage: projectStorage("library", { rootDir: sandbox.root }) });
    await kit.saveApiKey("openai", "project-secret");
    expect(await kit.getCredential("openai")).toMatchObject({ type: "api-key", secretRef: "provider:openai:api-key" });
    expect(await Bun.file(projectSecretsPath(sandbox, "library")).text()).toContain("project-secret");

    await kit.selectModel("openai", "gpt-5.5");
    expect(await runCli(sandbox, ["path", "--project", "library"])).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: `${projectConfigPath(sandbox, "library")}\n`,
    });
    expect(await runCli(sandbox, ["current", "--project", "library"])).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "openai/gpt-5.5\n",
    });

    await kit.removeCredential("openai");
    expect(await kit.getCredential("openai")).toBeUndefined();
    expect(await pathExists(projectSecretsPath(sandbox, "library"))).toBe(false);
  });
});

test("Given the library-only global storage contract, when API-key CRUD completes, then global state is isolated without adding a CLI flag", async () => {
  await inCliSandbox(async (sandbox) => {
    const previousConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = sandbox.configHome;
    try {
      const kit = createAuthKit({ storage: globalStorage("global-cli-contract") });
      await kit.saveApiKey("openai", "global-secret");
      expect(await kit.getCredential("openai")).toMatchObject({ type: "api-key", secretRef: "provider:openai:api-key" });
      const globalSecretPath = kit.secrets.path;
      if (!globalSecretPath) throw new Error("Global storage requires a secrets path");
      expect(await Bun.file(globalSecretPath).text()).toContain("global-secret");

      await kit.removeCredential("openai");
      expect(await kit.getCredential("openai")).toBeUndefined();
      expect(await pathExists(globalSecretPath)).toBe(false);
    } finally {
      if (previousConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousConfigHome;
    }
  });
});
