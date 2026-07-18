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

test("runtimeAuth refreshes OpenAI Codex tokens within five minutes and persists rotation", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const fetch = Object.assign(vi.fn<typeof globalThis.fetch>().mockResolvedValue(
		new Response(
			JSON.stringify({
				access_token: "refreshed-access",
				refresh_token: "refreshed-refresh",
				id_token: jwtWithPayload({ chatgpt_account_id: "acct_refreshed" }),
				expires_in: 3600,
			}),
		),
	), { preconnect: globalThis.fetch.preconnect });
	vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
	await kit.secrets.set("provider:openai:oauth:access-token", "expired-access");
	await kit.secrets.set("provider:openai:oauth:refresh-token", "old-refresh");
	await kit.saveExternalOAuth("openai", {
		adapter: "openai-codex",
		accessTokenRef: "provider:openai:oauth:access-token",
		refreshTokenRef: "provider:openai:oauth:refresh-token",
		expiresAt: String(Date.now() + 4 * 60_000),
		accountId: "acct_old",
		baseUrl: "https://chatgpt.com/backend-api/codex",
		customMetadata: "preserve-me",
	});

	const runtime = await kit.runtimeAuth("openai");
	const state = await kit.readState();

	expect(fetch).toHaveBeenCalledWith("https://auth.openai.com/oauth/token", {
		method: "POST",
		redirect: "error",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
			grant_type: "refresh_token",
			refresh_token: "old-refresh",
		}),
	});
	expect(runtime.external).toEqual(
		expect.objectContaining({
			accessToken: "refreshed-access",
			accountId: "acct_refreshed",
			headers: {
				Authorization: "Bearer refreshed-access",
				"ChatGPT-Account-Id": "acct_refreshed",
			},
		}),
	);
	expect(runtime.external).not.toHaveProperty("refreshToken");
	expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe(
		"refreshed-access",
	);
	expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe(
		"refreshed-refresh",
	);
	expect(state.credentials.openai).toEqual(
		expect.objectContaining({
			metadata: expect.objectContaining({
				accessTokenRef: "provider:openai:oauth:access-token",
				refreshTokenRef: "provider:openai:oauth:refresh-token",
				accountId: "acct_refreshed",
				customMetadata: "preserve-me",
			}),
		}),
	);
});
test("runtimeAuth does not refresh OpenAI Codex tokens beyond five minutes", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const fetch = Object.assign(vi.fn<typeof globalThis.fetch>(), {
		preconnect: globalThis.fetch.preconnect,
	});
	vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
	await kit.secrets.set("provider:openai:oauth:access-token", "current-access");
	await kit.secrets.set("provider:openai:oauth:refresh-token", "current-refresh");
	await kit.saveExternalOAuth("openai", {
		adapter: "openai-codex",
		accessTokenRef: "provider:openai:oauth:access-token",
		refreshTokenRef: "provider:openai:oauth:refresh-token",
		expiresAt: String(Date.now() + 6 * 60_000),
		accountId: "acct_current",
	});

	const runtime = await kit.runtimeAuth("openai");

	expect(fetch).not.toHaveBeenCalled();
	expect(runtime.external).toEqual(
		expect.objectContaining({
			accessToken: "current-access",
			accountId: "acct_current",
		}),
	);
});
