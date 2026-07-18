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

test("CLIProxyAPI provisioning runs after warning confirmation and before save", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const order: string[] = [];
	const provisionCliProxyApi = vi
		.fn<CliProxyApiProvisioner>()
		.mockImplementation(async () => {
			order.push("provision");
			return "/tmp/cli-proxy-api-order";
		});
	const runCliProxyApiLogin = vi
		.fn<CliProxyApiLoginRunner>()
		.mockImplementation(async () => {
			order.push("login");
		});
	const originalSaveExternalOAuth = kit.saveExternalOAuth.bind(kit);
	vi.spyOn(kit, "saveExternalOAuth").mockImplementation(
		async (providerId, metadata) => {
			order.push("save");
			return originalSaveExternalOAuth(providerId, metadata);
		},
	);
	const confirm = vi
		.fn<PromptAdapter["confirm"]>()
		.mockImplementation(async () => {
			order.push("confirm");
			return true;
		});
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm,
		password: vi.fn(),
		info: vi.fn(),
	};

	await loginWithPrompts(kit, "google", promptAdapter, {
		provisionCliProxyApi,
		runCliProxyApiLogin,
	});

	expect(order).toEqual(["confirm", "provision", "login", "save"]);
	expect(kit.saveExternalOAuth).toHaveBeenCalledWith(
		"google",
		expect.objectContaining({ cliProxyApiPath: "/tmp/cli-proxy-api-order" }),
	);
});

test("CLIProxyAPI login failure throws and saves nothing", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const provisionCliProxyApi = vi
		.fn<CliProxyApiProvisioner>()
		.mockResolvedValue("/tmp/cli-proxy-api");
	const runCliProxyApiLogin = vi
		.fn<CliProxyApiLoginRunner>()
		.mockRejectedValue(
			new Error(
				"CLIProxyAPI login failed for Google Gemini: process exited with exit code 1",
			),
		);
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn().mockResolvedValue(true),
		password: vi.fn(),
		info: vi.fn(),
	};

	await expect(
		loginWithPrompts(kit, "google", promptAdapter, {
			provisionCliProxyApi,
			runCliProxyApiLogin,
		}),
	).rejects.toThrow(
		"CLIProxyAPI login failed for Google Gemini: process exited with exit code 1",
	);

	const state = await kit.readState();
	expect(state.credentials.google).toBeUndefined();
});

test("declined CLIProxyAPI warning saves nothing", async () => {
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
		confirm: vi.fn().mockResolvedValue(false),
		password: vi.fn(),
		info: vi.fn(),
	};

	const credential = await loginWithPrompts(kit, "anthropic", promptAdapter, {
		provisionCliProxyApi,
		runCliProxyApiLogin,
	});
	const state = await kit.readState();

	expect(credential).toBeUndefined();
	expect(provisionCliProxyApi).not.toHaveBeenCalled();
	expect(runCliProxyApiLogin).not.toHaveBeenCalled();
	expect(state.credentials.anthropic).toBeUndefined();
});
