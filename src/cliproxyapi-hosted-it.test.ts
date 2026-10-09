import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { renderCliProxyServerConfig } from "./cliproxyapi-config.js";
import { createCliProxyManagementClient } from "./cliproxyapi-management.js";

const binary = process.env["CLIPROXYAPI_IT_BINARY"];

// Opt-in only: boots a real CLIProxyAPI with the rendered hosted config and
// checks the credentials + prefix-patch surface it relies on. Never runs by
// default and never downloads binaries.
test.skipIf(binary === undefined)("Given a real CLIProxyAPI binary, when booted with the rendered config, then credentials and prefix patching work", async () => {
  if (binary === undefined) throw new Error("CLIPROXYAPI_IT_BINARY is required");
  const dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-cliproxy-it-"));
  const authDir = join(dir, "auth");
  const port = 18_317;
  const managementKey = "it-management-key";
  await writeFile(join(dir, "config.yaml"), renderCliProxyServerConfig({ port, managementKey, clientApiKeys: ["it-client-key"], authDir }));
  const child = Bun.spawn([binary, "--config", join(dir, "config.yaml")], { stdout: "pipe", stderr: "pipe" });
  try {
    const api = createCliProxyManagementClient({ baseUrl: `http://127.0.0.1:${port}`, managementKey, timeoutMs: 5_000 });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await Bun.sleep(500);
      try {
        await api.listCredentials();
        ready = true;
      } catch {
        // Still booting.
      }
    }
    expect(ready).toBeTrue();
    expect(await api.listCredentials()).toEqual([]);
    await writeFile(join(authDir, "claude-it-user@example.com.json"), JSON.stringify({ type: "claude", email: "it-user@example.com" }));
    await Bun.sleep(2_000);
    const files = await api.listCredentials();
    const target = files.find((file) => file.name === "claude-it-user@example.com.json");
    expect(target?.provider ?? target?.type).toBe("claude");
    if (target !== undefined) {
      await api.patchCredentialPrefix(target.name, "t-itprefix");
      await api.deleteCredential(target.name);
      expect((await api.listCredentials()).some((file) => file.name === target.name)).toBeFalse();
    }
  } finally {
    child.kill("SIGTERM");
    await child.exited;
  }
}, 60_000);
