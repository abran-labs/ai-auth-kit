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

function requireProvider(providerId: string) {
	const provider = DEFAULT_PROVIDERS.find((entry) => entry.id === providerId);
	expect(provider).toBeDefined();
	if (!provider) throw new Error(`Missing provider fixture: ${providerId}`);
	return provider;
}

test("provider catalog mirrors a broad models.dev-style catalog", () => {
	expect(DEFAULT_PROVIDERS.length).toBeGreaterThanOrEqual(70);

	const providerIds = new Set(DEFAULT_PROVIDERS.map((provider) => provider.id));
	expect(providerIds.size).toBe(DEFAULT_PROVIDERS.length);

	for (const providerId of [
		"openai",
		"anthropic",
		"google",
		"openrouter",
		"github-copilot",
		"amazon-bedrock",
		"google-vertex-anthropic",
		"azure",
		"cloudflare-ai-gateway",
		"vercel",
		"groq",
		"togetherai",
		"deepinfra",
		"huggingface",
		"cerebras",
		"perplexity",
		"gitlab",
		"ollama",
	]) {
		expect(providerIds.has(providerId)).toBe(true);
	}
});
test("every provider exposes models and supported auth methods", () => {
	const validAuthMethods = new Set([
		"api-key",
		"env",
		"oauth-external",
		"none",
	]);

	for (const provider of DEFAULT_PROVIDERS) {
		expect(provider.models.length).toBeGreaterThan(0);
		expect(provider.authMethods.length).toBeGreaterThan(0);
		for (const method of provider.authMethods) {
			expect(validAuthMethods.has(method)).toBe(true);
		}
	}
});
test("OpenAI catalog exposes the canonical GPT-5.6 suite exactly once", () => {
	const openai = requireProvider("openai");
	const gpt56Models = openai.models.filter((model) =>
		model.id.startsWith("gpt-5.6-"),
	);

	expect(gpt56Models.map((model) => model.id).sort()).toEqual([
		"gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra",
	]);
});
