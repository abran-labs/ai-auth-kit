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

test("GitHub Copilot device flow saves account token ref", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const infoSpy = vi.fn<(message: string) => void>();
	const fetch = Object.assign(vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					device_code: "device-github",
					user_code: "GITHUB-CODE",
					verification_uri: "https://github.com/login/device",
					expires_in: 900,
					interval: 0,
				}),
			),
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ access_token: "github-access" })),
		), { preconnect: globalThis.fetch.preconnect });
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn(),
		password: vi.fn(),
		info: infoSpy,
	};

	const credential = await loginWithPrompts(kit, "github-copilot", promptAdapter, {
		accountOAuthDeps: {
			fetch,
			sleep: async () => {},
			now: () => 1000,
		},
	});
	const runtime = await kit.runtimeAuth("github-copilot");

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: expect.objectContaining({
				adapter: "github-copilot-device",
				baseUrl: "https://api.githubcopilot.com",
			}),
		}),
	);
	expect(infoSpy).toHaveBeenCalledWith(
		"Open https://github.com/login/device and enter code: GITHUB-CODE",
	);
	expect(runtime.external).toEqual(
		expect.objectContaining({
			adapter: "github-copilot-device",
			accessToken: "github-access",
			headers: { Authorization: "Bearer github-access" },
		}),
	);
});
