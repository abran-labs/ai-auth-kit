import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { z } from "zod";
import {
  DEFAULT_PROVIDERS,
  createAuthKit,
  projectStorage,
  runCliProxyApiLogin,
} from "../src/index.js";
import type { AuthKitState, ProviderDefinition } from "../src/index.js";

const fixtureRoot = join(process.cwd(), "test", "fixtures", "contracts");
const projectFlagContractSchema = z.object({
  target: z.object({ exitCode: z.literal("nonzero"), stderr: z.literal("Missing value for --project\n") }),
  malformedArgv: z.array(z.array(z.string()).min(2)),
});

async function inTemporaryDirectory<T>(action: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-contract-"));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function provider(id: string): ProviderDefinition {
  const found = DEFAULT_PROVIDERS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing provider fixture: ${id}`);
  return found;
}

function storagePath(store: { readonly path?: string }): string {
  if (!store.path) throw new Error("Contract storage requires a filesystem path");
  return store.path;
}

async function runCli(invocation: { readonly args: readonly string[]; readonly home: string }): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
  const processResult = Bun.spawn({
    cmd: [process.execPath, "--bun", "src/cli.ts", ...invocation.args],
    cwd: process.cwd(),
    env: { ...process.env, HOME: invocation.home, XDG_CONFIG_HOME: join(invocation.home, ".config"), XDG_STATE_HOME: join(invocation.home, ".state") },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: await processResult.exited,
    stdout: await new Response(processResult.stdout).text(),
    stderr: await new Response(processResult.stderr).text(),
  };
}

test("Given the public root, when enumerated, then it exposes the frozen runtime API", async () => {
  const publicApi = await import("../src/index.js");
  expect(Object.keys(publicApi).sort()).toEqual([
    "AuthKit",
    "CLIPROXYAPI_BASE_URL",
    "CLIPROXYAPI_LATEST_RELEASE_URL",
    "CLIPROXYAPI_REPO",
    "DEFAULT_PROVIDERS",
    "FileAuthKitStore",
    "FileSecretStore",
    "confirmExternalOAuthWarning",
    "createAuthKit",
    "createProjectAuthKit",
    "emptyState",
    "getAuthMethodHint",
    "getAuthMethodLabel",
    "getCliProxyApiLabel",
    "getCliProxyApiWarning",
    "getExternalAuthMetadata",
    "getOAuthMethodLabel",
    "globalConfigDir",
    "globalStorage",
    "isAccountOAuthProvider",
    "isCliProxyApiProvider",
    "isExternalOAuthProvider",
    "loginAccountOAuthProvider",
    "loginGitHubCopilotAccount",
    "loginOpenAiAccount",
    "loginWithPrompts",
    "pickAuthMethod",
    "pickModel",
    "pickProvider",
    "projectConfigDir",
    "projectStorage",
    "provisionCliProxyApi",
    "provisionCliProxyApiForProvider",
    "runCliProxyApiLogin",
  ]);
});

test("Given the CLI, when help is requested, then stable commands and project flags are printed", async () => {
  await inTemporaryDirectory(async (home) => {
    const result = await runCli({ args: ["--help"], home });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(await readFile(join(fixtureRoot, "cli-help.txt"), "utf8"));
    expect(result.stderr).toBe("");
  });
});

test("Given malformed project flags, when the 0.2.0 contract is read, then every missing-value form has one exact target error", async () => {
  const parsed: unknown = JSON.parse(await readFile(join(fixtureRoot, "project-flag-contract.json"), "utf8"));
  const contract = projectFlagContractSchema.parse(parsed);
  expect(contract.target).toEqual({ exitCode: "nonzero", stderr: "Missing value for --project\n" });
  expect(contract.malformedArgv).toEqual([
    ["path", "--project"], ["path", "-p"], ["path", "--project", "--help"],
    ["path", "-p", "--help"], ["path", "--project", ""], ["path", "-p", ""],
  ]);
});

test("Given malformed project flags, when every missing-value form is invoked, then each fails with the exact canonical error", async () => {
  const parsed: unknown = JSON.parse(await readFile(join(fixtureRoot, "project-flag-contract.json"), "utf8"));
  const contract = projectFlagContractSchema.parse(parsed);
  await inTemporaryDirectory(async (home) => {
    for (const args of contract.malformedArgv) {
      const result = await runCli({ args, home });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBe(contract.target.stderr);
      expect(result.stdout).toBe("");
    }
  });
});

test("Given project storage, when a selected API-key state is written, then bytes and modes stay compatible", async () => {
  await inTemporaryDirectory(async (rootDir) => {
    const storage = projectStorage("contract", { rootDir });
    const state: AuthKitState = {
      credentials: { openai: { type: "api-key", secretRef: "provider:openai:api-key", createdAt: "2026-07-17T00:00:00.000Z" } },
      selectedModel: { providerId: "openai", modelId: "gpt-5.5", updatedAt: "2026-07-17T00:00:00.000Z" },
      updatedAt: "2026-07-17T00:00:00.000Z",
    };
    await storage.store.write(state);
    await storage.secrets.set("provider:openai:api-key", "fixture-secret");
    const configPath = storagePath(storage.store);
    const secretPath = storagePath(storage.secrets);
    expect(await readFile(configPath, "utf8")).toBe(await readFile(join(fixtureRoot, "config.json"), "utf8"));
    expect(await readFile(secretPath, "utf8")).toBe(await readFile(join(fixtureRoot, "secrets.json"), "utf8"));
    expect((await stat(configPath)).mode & 0o777).toBe(0o600);
    expect((await stat(secretPath)).mode & 0o777).toBe(0o600);
    expect((await stat(join(configPath, ".."))).mode & 0o777).toBe(0o700);
  });
});

test("Given interrupted atomic storage writes, when write and fsync boundaries fail, then prior bytes and no temp files remain", async () => {
  await inTemporaryDirectory(async (rootDir) => {
    const storage = projectStorage("interrupt", { rootDir });
    const state: AuthKitState = { credentials: {}, updatedAt: "2026-07-17T00:00:00.000Z" };
    await storage.store.write(state);
    if (!storage.store.path) throw new Error("Expected config path");
    const prior = await readFile(storage.store.path, "utf8");
    for (const boundary of ["write", "fsync"] as const) {
      process.env.AI_AUTH_KIT_INTERRUPT_AT = boundary;
      await expect(storage.store.write({ ...state, updatedAt: "2026-07-18T00:00:00.000Z" })).rejects.toThrow("Interrupted atomic write");
      expect(await readFile(storage.store.path, "utf8")).toBe(prior);
      expect((await readdir(join(storage.store.path, ".."))).some((entry) => entry.endsWith(".tmp"))).toBe(false);
    }
    process.env.AI_AUTH_KIT_INTERRUPT_AT = "rename";
    await expect(storage.store.write({ ...state, updatedAt: "2026-07-19T00:00:00.000Z" })).rejects.toThrow("Interrupted atomic write after rename");
    expect(await readFile(storage.store.path, "utf8")).not.toBe(prior);
    expect((await readdir(join(storage.store.path, ".."))).some((entry) => entry.endsWith(".tmp"))).toBe(false);
    delete process.env.AI_AUTH_KIT_INTERRUPT_AT;
  });
});

test("Given reviewed providers, when auth methods are inspected, then remote metadata cannot add behavior", () => {
  expect(provider("openai").authMethods).toEqual(["api-key", "oauth-external", "env"]);
  expect(provider("anthropic").authMethods).toEqual(["api-key", "oauth-external", "env"]);
  expect(provider("google").authMethods).toEqual(["api-key", "oauth-external", "env"]);
  expect(provider("github-copilot").authMethods).toEqual(["oauth-external", "env"]);
  expect(provider("ollama").authMethods).toEqual(["none", "env"]);
  for (const entry of DEFAULT_PROVIDERS) {
    expect(Object.keys(entry)).not.toContain("command");
    expect(Object.keys(entry)).not.toContain("headers");
    expect(Object.keys(entry)).not.toContain("oauth");
  }
});

test("Given sealed-current CLIProxyAPI login, when Claude or Google is selected, then the documented Google migration gap is explicit", async () => {
	const binaryPath = join(await mkdtemp(join(tmpdir(), "ai-auth-kit-contract-cli-")), "cli-proxy-api");
	await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const child = new EventEmitter();
	const claudeLogin = runCliProxyApiLogin(binaryPath, provider("anthropic"), { spawn: () => child });
	await Bun.sleep(1);
  child.emit("exit", 0, null);
	expect(await claudeLogin).toEqual({ binaryPath, args: ["--claude-login"] });
  const googleChild = new EventEmitter();
	const googleLogin = runCliProxyApiLogin(binaryPath, provider("google"), { spawn: () => googleChild });
	await Bun.sleep(1);
  googleChild.emit("exit", 0, null);
	expect(await googleLogin).toEqual({ binaryPath, args: ["--antigravity-login"] });
});

test("Given a removed configured model, when the sealed-current behavior is characterized, then the intentional gap is explicit", async () => {
  await inTemporaryDirectory(async (rootDir) => {
    const storage = projectStorage("historical", { rootDir });
    await storage.store.write({ credentials: {}, selectedModel: { providerId: "removed", modelId: "gone", updatedAt: "2026-07-17T00:00:00.000Z" }, updatedAt: "2026-07-17T00:00:00.000Z" });
    expect(await createAuthKit({ storage, providers: [] }).resolveSelection()).toBeUndefined();
  });
});
