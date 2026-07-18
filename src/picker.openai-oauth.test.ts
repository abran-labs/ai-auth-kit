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

function jwtWithPayload(payload: Record<string, unknown>): string {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `header.${encoded}.signature`;
}

test("OpenAI account OAuth browser flow saves token refs and validates callback state", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const infoSpy = vi.fn<(message: string) => void>();
	let callbackUrl: URL | undefined;
	const fetch = Object.assign(vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					access_token: "openai-access",
					refresh_token: "openai-refresh",
					id_token: jwtWithPayload({ chatgpt_account_id: "acct_123" }),
					expires_in: 3600,
				}),
			),
		), { preconnect: globalThis.fetch.preconnect });
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn(),
		password: vi.fn(),
		info: infoSpy,
	};

	const credential = await loginWithPrompts(kit, "openai", promptAdapter, {
		accountOAuthDeps: {
			fetch,
			now: () => Date.now(),
			openUrl: async (url) => {
				callbackUrl = new URL(url);
				const redirectUri = callbackUrl.searchParams.get("redirect_uri");
				const state = callbackUrl.searchParams.get("state");
				if (!redirectUri || !state) return false;
				expect(redirectUri).toBeTruthy();
				expect(callbackUrl.searchParams.get("code_challenge")).toBeTruthy();
				expect(callbackUrl.searchParams.get("scope")).toContain("offline_access");
				expect(callbackUrl.searchParams.get("codex_cli_simplified_flow")).toBe("true");
				expect(new URL(redirectUri).pathname).toBe("/auth/callback");
				const invalidUrl = new URL(redirectUri);
				invalidUrl.searchParams.set("code", "wrong-code");
				invalidUrl.searchParams.set("state", "wrong-state");
				const invalidResponse = await globalThis.fetch(invalidUrl);
				expect(invalidResponse.status).toBe(400);

				const successUrl = new URL(redirectUri);
				successUrl.searchParams.set("code", "browser-auth-code");
				successUrl.searchParams.set("state", state);
				void globalThis.fetch(successUrl);
				return true;
			},
		},
	});
	const runtime = await kit.runtimeAuth("openai");

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: expect.objectContaining({
				adapter: "openai-codex",
				accountId: "acct_123",
				baseUrl: "https://chatgpt.com/backend-api/codex",
			}),
		}),
	);
	expect(promptAdapter.select).toHaveBeenCalledTimes(1);
	expect(infoSpy).toHaveBeenCalledWith(
		"OpenAI sign-in opened in your browser. Finish sign-in there, then return here.",
	);
	expect(callbackUrl?.origin).toBe("https://auth.openai.com");
	expect(callbackUrl?.pathname).toBe("/oauth/authorize");
	const tokenRequest = fetch.mock.calls[0];
	expect(tokenRequest?.[0]).toBe("https://auth.openai.com/oauth/token");
	expect(String(tokenRequest?.[1]?.body)).toContain("code=browser-auth-code");
	expect(String(tokenRequest?.[1]?.body)).toContain("code_verifier=");
	expect(runtime.external).toEqual(
			expect.objectContaining({
				adapter: "openai-codex",
				accessToken: "openai-access",
				accountId: "acct_123",
			headers: {
				Authorization: "Bearer openai-access",
				"ChatGPT-Account-Id": "acct_123",
			},
		}),
	);
});
test("OpenAI account OAuth falls back to device flow when browser callback does not complete", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const infoSpy = vi.fn<(message: string) => void>();
	const fetch = Object.assign(vi
		.fn<typeof globalThis.fetch>()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					device_auth_id: "device-openai",
					user_code: "OPENAI-CODE",
					interval: "1",
				}),
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					authorization_code: "openai-auth-code",
					code_verifier: "openai-code-verifier",
				}),
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					access_token: "openai-access",
					refresh_token: "openai-refresh",
					id_token: jwtWithPayload({ chatgpt_account_id: "acct_456" }),
					expires_in: 3600,
				}),
			),
		), { preconnect: globalThis.fetch.preconnect });
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn(),
		password: vi.fn(),
		info: infoSpy,
	};

	const credential = await loginWithPrompts(kit, "openai", promptAdapter, {
		accountOAuthDeps: {
			fetch,
			sleep: async () => {},
			now: () => 1000,
			openAiLoopbackTimeoutMs: 1,
			openUrl: async () => false,
		},
	});

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: expect.objectContaining({
				adapter: "openai-codex",
				accountId: "acct_456",
			}),
		}),
	);
	expect(infoSpy.mock.calls[0]?.[0]).toContain(
		"Open this URL to continue OpenAI sign-in:",
	);
	expect(infoSpy.mock.calls[1]?.[0]).toContain(
		"Browser sign-in unavailable. Falling back to device code.",
	);
	expect(infoSpy.mock.calls[2]?.[0]).toBe(
		"Open https://auth.openai.com/codex/device and enter code: OPENAI-CODE",
	);
});
