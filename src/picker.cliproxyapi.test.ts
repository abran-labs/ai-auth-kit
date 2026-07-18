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

test("CLIProxyAPI external auth prompts explicit risk warning before save", async () => {
	const anthropic = requireProvider("anthropic");
	const confirm = vi.fn<PromptAdapter["confirm"]>().mockResolvedValue(true);
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn(),
		confirm,
		password: vi.fn(),
		info: vi.fn(),
	};

	const accepted = await confirmExternalOAuthWarning(anthropic, promptAdapter);

	expect(accepted).toBe(true);
	expect(confirm).toHaveBeenCalledTimes(1);
	expect(confirm.mock.calls[0]?.[0]).toEqual({
		message: expect.stringContaining(
			"external/unofficial account-routing flows",
		),
		initialValue: false,
	});
	expect(confirm.mock.calls[0]?.[0].message).toContain(
		"may violate provider terms",
	);
	expect(confirm.mock.calls[0]?.[0].message).toContain("blocked or limited");
	expect(confirm.mock.calls[0]?.[0].message).toContain(CLIPROXYAPI_BASE_URL);
});

test("confirmed Anthropic CLIProxyAPI auth saves external credential metadata", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const provisionCliProxyApi = vi
		.fn<CliProxyApiProvisioner>()
		.mockResolvedValue("/tmp/cli-proxy-api");
	const runCliProxyApiLogin = vi
		.fn<CliProxyApiLoginRunner>()
		.mockResolvedValue();
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn().mockResolvedValue(true),
		password: vi.fn(),
		info: vi.fn(),
	};

	const credential = await loginWithPrompts(kit, "anthropic", promptAdapter, {
		provisionCliProxyApi,
		runCliProxyApiLogin,
	});
	const saved = await kit.getCredential("anthropic");

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: {
				adapter: "cliproxyapi",
				provider: "anthropic",
				baseUrl: CLIPROXYAPI_BASE_URL,
				cliProxyApiPath: "/tmp/cli-proxy-api",
				warningAccepted: "true",
			},
		}),
	);
	expect(provisionCliProxyApi).toHaveBeenCalledWith(
		kit,
		requireProvider("anthropic"),
	);
	expect(runCliProxyApiLogin).toHaveBeenCalledWith(
		"/tmp/cli-proxy-api",
		requireProvider("anthropic"),
	);
	expect(saved).toEqual(credential);
});

test("confirmed Google CLIProxyAPI auth saves external credential metadata", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const provisionCliProxyApi = vi
		.fn<CliProxyApiProvisioner>()
		.mockResolvedValue("/tmp/cli-proxy-api-google");
	const runCliProxyApiLogin = vi
		.fn<CliProxyApiLoginRunner>()
		.mockResolvedValue();
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn().mockResolvedValue(true),
		password: vi.fn(),
		info: vi.fn(),
	};

	const credential = await loginWithPrompts(kit, "google", promptAdapter, {
		provisionCliProxyApi,
		runCliProxyApiLogin,
	});
	const saved = await kit.getCredential("google");

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: {
				adapter: "cliproxyapi",
				provider: "google",
				baseUrl: CLIPROXYAPI_BASE_URL,
				cliProxyApiPath: "/tmp/cli-proxy-api-google",
				warningAccepted: "true",
			},
		}),
	);
	expect(saved).toEqual(credential);
});
