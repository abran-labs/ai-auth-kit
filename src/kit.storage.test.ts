import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { DEFAULT_PROVIDERS } from "./catalog.js";
import {
	CLIPROXYAPI_BASE_URL,
	getExternalAuthMetadata,
	isCliProxyApiProvider,
} from "./external-auth.js";
import { createAuthKit, createProjectAuthKit } from "./kit.js";
import {
	confirmExternalOAuthWarning,
	getAuthMethodHint,
	getAuthMethodLabel,
	getInteractiveAuthMethods,
	getOAuthComingSoonSubject,
	type LoginWithPromptsOptions,
	loginWithPrompts,
	type PromptAdapter,
	pickAuthMethod,
	pickProvider,
} from "./picker.js";
import { projectStorage } from "./storage.js";
import type { AuthKitState, AuthKitStorage, SecretStore } from "./types.js";

let dir: string;
const vi = { fn: mock, spyOn };
const environmentKeys = [
	"OPENAI_API_KEY",
	"GEMINI_API_KEY",
	"GOOGLE_API_KEY",
] as const;
let originalEnvironment = new Map<string, string | undefined>();
type CliProxyApiProvisioner = NonNullable<
	LoginWithPromptsOptions["provisionCliProxyApi"]
>;
type CliProxyApiLoginRunner = NonNullable<
	LoginWithPromptsOptions["runCliProxyApiLogin"]
>;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-test-"));
	originalEnvironment = new Map(
		environmentKeys.map((key) => [key, process.env[key]]),
	);
});

afterEach(async () => {
	mock.restore();
	for (const [key, value] of originalEnvironment) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	await rm(dir, { recursive: true, force: true });
});

test("preserves prior credential while storing API key refs separately from project-owned state", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const credential = await kit.saveApiKey("openai", "sk-test");
	const state = await kit.readState();
	const runtime = await kit.runtimeAuth("openai");

	expect(credential.type).toBe("api-key");
	expect(state.credentials.openai).toEqual(credential);
	expect(JSON.stringify(state)).not.toContain("sk-test");
	expect(runtime.env.OPENAI_API_KEY).toBe("sk-test");
	expect(kit.store.path).toContain(
		join(".ai-auth-kit", "test-tool", "config.json"),
	);
});
test("restores state after interrupted write through explicit host project storage", async () => {
	const kit = createAuthKit({
		storage: projectStorage("explicit-tool", { rootDir: dir }),
	});
	await kit.saveEnvCredential("google", "GEMINI_API_KEY");
	await kit.selectModel("google", "gemini-3.1-flash-lite");
	const selection = await kit.resolveSelection();

	expect(selection?.provider.id).toBe("google");
	expect(selection?.model.id).toBe("gemini-3.1-flash-lite");
	expect(selection?.credential?.type).toBe("env");
	expect(kit.store.path).toContain(
		join(".ai-auth-kit", "explicit-tool", "config.json"),
	);
});
test("resolveSelection returns undefined for stale removed models", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	await kit.store.write({
		credentials: {},
		selectedModel: {
			providerId: "google",
			modelId: "gemini-2.5-flash-lite",
			updatedAt: new Date().toISOString(),
		},
		updatedAt: new Date().toISOString(),
	});

	await expect(kit.resolveSelection()).resolves.toBeUndefined();
});
test("rejects unsupported auth method", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	await expect(kit.saveApiKey("ollama", "token")).rejects.toThrow(
		"does not support API key auth",
	);
});

function deletionStorage(options: { readonly failStateWrite?: boolean }): AuthKitStorage {
  let state: AuthKitState = {
    credentials: { openai: { type: "api-key", secretRef: "provider:openai:api-key", createdAt: "2026-07-17T00:00:00.000Z" } },
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
  const values = new Map<string, string>([["provider:openai:api-key", "secret"]]);
  const secrets: SecretStore = {
    get: async (ref) => values.get(ref),
    set: async (ref, value) => { values.set(ref, value); },
    delete: async (ref) => { values.delete(ref); },
    reconcile: async (liveRefs) => {
      for (const ref of values.keys()) {
        if (!liveRefs.includes(ref)) values.delete(ref);
      }
    },
  };
  return {
    store: {
      read: async () => state,
      write: async (next) => {
        if (options.failStateWrite) throw new Error("state fault");
        state = next;
      },
    },
    secrets,
  };
}

test("Given a state-write fault during credential deletion, when deletion is attempted, then the previous state and secret remain retryable", async () => {
  const storage = deletionStorage({ failStateWrite: true });
  const kit = createAuthKit({ storage });

  await expect(kit.removeCredential("openai")).rejects.toThrow("state fault");

  expect((await kit.readState()).credentials.openai).toMatchObject({ type: "api-key" });
  expect(await storage.secrets.get("provider:openai:api-key")).toBe("secret");
});

test("Given a real storage delete interruption, when credential removal is retried, then state and secret remain consistent before retry and delete together after retry", async () => {
  const kit = createProjectAuthKit("delete-retry", { rootDir: dir });
  await kit.saveApiKey("openai", "retry-secret");
  process.env.AI_AUTH_KIT_INTERRUPT_AT = "unlink";

  await expect(kit.removeCredential("openai")).rejects.toThrow("cleanup pending; retry");

  expect((await kit.store.read()).credentials.openai).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:api-key")).toBe("retry-secret");
  delete process.env.AI_AUTH_KIT_INTERRUPT_AT;
  expect((await kit.readState()).credentials.openai).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:api-key")).toBeUndefined();
});
