import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createAuthKit } from "./kit.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("stores API key refs separately from state", async () => {
  const kit = createAuthKit({ configDir: dir });
  const credential = await kit.saveApiKey("openai", "sk-test");
  const state = await kit.readState();
  const runtime = await kit.runtimeAuth("openai");

  expect(credential.type).toBe("api-key");
  expect(state.credentials.openai).toEqual(credential);
  expect(JSON.stringify(state)).not.toContain("sk-test");
  expect(runtime.env.OPENAI_API_KEY).toBe("sk-test");
});

test("selects and resolves a provider model", async () => {
  const kit = createAuthKit({ configDir: dir });
  await kit.saveEnvCredential("google", "GEMINI_API_KEY");
  await kit.selectModel("google", "gemini-2.5-flash-lite");
  const selection = await kit.resolveSelection();

  expect(selection?.provider.id).toBe("google");
  expect(selection?.model.id).toBe("gemini-2.5-flash-lite");
  expect(selection?.credential?.type).toBe("env");
});

test("rejects unsupported auth method", async () => {
  const kit = createAuthKit({ configDir: dir });
  await expect(kit.saveApiKey("ollama", "token")).rejects.toThrow("does not support API key auth");
});
