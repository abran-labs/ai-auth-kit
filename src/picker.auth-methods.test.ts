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

test("formats human auth labels and hints", () => {
	const openai = requireProvider("openai");
	const anthropic = requireProvider("anthropic");
	const google = requireProvider("google");
	const github = requireProvider("github-copilot");
	const ollama = requireProvider("ollama");

	expect(getAuthMethodLabel(openai, "api-key")).toBe("Paste OpenAI API key");
	expect(getAuthMethodHint(openai, "api-key")).toBe(
		"Paste once and store locally",
	);
	expect(getAuthMethodLabel(openai, "env", { OPENAI_API_KEY: "sk-test" })).toBe(
		"Use OPENAI_API_KEY from shell",
	);
	expect(getAuthMethodHint(openai, "env", { OPENAI_API_KEY: "sk-test" })).toBe(
		"Use existing shell credential",
	);
	expect(getAuthMethodLabel(openai, "oauth-external")).toBe(
		"Use ChatGPT Plus/Pro (browser sign-in)",
	);
	expect(getOAuthComingSoonSubject(openai)).toBe("ChatGPT Plus/Pro sign-in");
	expect(getAuthMethodHint(openai, "oauth-external")).toBeUndefined();
	expect(openai.authMethods).toEqual(["api-key", "oauth-external", "env"]);
	expect(isCliProxyApiProvider(anthropic)).toBe(true);
	expect(getAuthMethodLabel(anthropic, "oauth-external")).toBe(
		"Sign in with Claude (use at your own risk)",
	);
	expect(getAuthMethodHint(anthropic, "oauth-external")).toBeUndefined();
	expect(anthropic.authMethods).toEqual(["api-key", "oauth-external", "env"]);
	expect(getExternalAuthMetadata(anthropic)).toEqual({
		adapter: "cliproxyapi",
		provider: "anthropic",
		baseUrl: CLIPROXYAPI_BASE_URL,
		warningAccepted: "true",
	});
	expect(getAuthMethodLabel(google, "oauth-external")).toBe(
		"Sign in with Gemini (use at your own risk)",
	);
	expect(getAuthMethodHint(google, "oauth-external")).toBeUndefined();
	expect(getExternalAuthMetadata(google)).toEqual({
		adapter: "cliproxyapi",
		provider: "google",
		baseUrl: CLIPROXYAPI_BASE_URL,
		warningAccepted: "true",
	});
	expect(getAuthMethodLabel(github, "oauth-external")).toBe(
		"Use GitHub Copilot",
	);
	expect(getOAuthComingSoonSubject(github)).toBe("GitHub Copilot sign-in");
	expect(getAuthMethodLabel(github, "env", { GH_TOKEN: "gh-test" })).toBe(
		"Use GH_TOKEN from shell",
	);
	expect(github.authMethods).toEqual(["oauth-external", "env"]);
	expect(getAuthMethodLabel(ollama, "none")).toBe("No auth needed");
});
test("interactive auth methods hide env when shell credential missing", async () => {
	const openai = requireProvider("openai");
	const select = vi.fn().mockResolvedValue("api-key");
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select,
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	expect(getInteractiveAuthMethods(openai, {})).toEqual(["api-key", "oauth-external"]);
	await pickAuthMethod(openai, promptAdapter, {});

	expect(select).toHaveBeenCalledWith({
		message: "Select auth method",
		options: [
			{
				value: "api-key",
				label: "Paste OpenAI API key",
				hint: "Paste once and store locally",
			},
			{
				value: "oauth-external",
				label: "Use ChatGPT Plus/Pro (browser sign-in)",
				hint: undefined,
			},
		],
	});
});
test("interactive auth methods include env when shell credential exists", async () => {
	const github = requireProvider("github-copilot");
	const select = vi.fn().mockResolvedValue("env");
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select,
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	expect(
		getInteractiveAuthMethods(github, { GITHUB_TOKEN: "ghu_test" }),
	).toEqual(["oauth-external", "env"]);
	await pickAuthMethod(github, promptAdapter, { GITHUB_TOKEN: "ghu_test" });

	expect(select).toHaveBeenCalledWith({
		message: "Select auth method",
		options: [
			{
				value: "oauth-external",
				label: "Use GitHub Copilot",
				hint: undefined,
			},
			{
				value: "env",
				label: "Use GITHUB_TOKEN from shell",
				hint: "Use existing shell credential",
			},
		],
	});
});
test("provider picker includes account OAuth providers", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const autocompleteCalls: unknown[] = [];
	const autocomplete: PromptAdapter["autocomplete"] = async (options) => {
		autocompleteCalls.push(options);
		return Symbol();
	};
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete,
		select: vi.fn(),
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	await pickProvider(kit, "Select provider", promptAdapter);

	expect(autocompleteCalls[0]).toEqual(
		expect.objectContaining({ options: expect.arrayContaining([
			expect.objectContaining({ value: "openai", label: "OpenAI" }),
			expect.objectContaining({ value: "anthropic", label: "Anthropic" }),
			expect.objectContaining({ value: "google", label: "Google" }),
			expect.objectContaining({ value: "github-copilot", label: "GitHub Copilot" }),
		]) }),
	);
});
test("CLIProxyAPI auth option carries inline risk warning", async () => {
	const google = requireProvider("google");
	const select = vi.fn().mockResolvedValue("oauth-external");
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select,
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	await pickAuthMethod(google, promptAdapter, {});

	expect(select).toHaveBeenCalledWith({
		message: "Select auth method",
		options: [
			{
				value: "api-key",
				label: "Paste Gemini API key",
				hint: "Paste once and store locally",
			},
			{
				value: "oauth-external",
				label: "Sign in with Gemini (use at your own risk)",
				hint: undefined,
			},
		],
	});
});
