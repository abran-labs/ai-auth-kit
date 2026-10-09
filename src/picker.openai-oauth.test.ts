import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { loginOpenAiAccount } from "./account-oauth.js";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { CHATGPT_ISSUER, resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { createProjectAuthKit } from "./kit.js";
import { loginWithPrompts, type PromptAdapter } from "./picker.js";

let dir: string;
const vi = { fn: mock, spyOn };
const NOW = Date.now();
const KID = "picker-openai-test";
const ISSUED = "oaiapp_pickerissued";
const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "ai-auth-kit-test-"));
});

afterEach(async () => {
	mock.restore();
	resetChatGptSigningKeysForTests();
	await rm(dir, { recursive: true, force: true });
});

function jwtWithPayload(payload: Record<string, unknown>): string {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `header.${encoded}.signature`;
}

function idToken(nonce: string): string {
	const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: KID })).toString("base64url");
	const payload = Buffer.from(JSON.stringify({
		iss: CHATGPT_ISSUER,
		sub: "user-sub",
		aud: ISSUED,
		exp: NOW / 1000 + 3600,
		iat: NOW / 1000,
		nonce,
		email: "dev@example.com",
	})).toString("base64url");
	const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
	return `${header}.${payload}.${signature}`;
}

function promptAdapterWith(info: (message: string) => void): PromptAdapter {
	return {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select: vi.fn().mockResolvedValue("oauth-external"),
		confirm: vi.fn(),
		password: vi.fn(),
		info,
	};
}

test("OpenAI oauth-external defaults to Sign in with ChatGPT plan", async () => {
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const infoSpy = vi.fn<(message: string) => void>();
	let nonce = "";
	const fetch = Object.assign(vi
		.fn<typeof globalThis.fetch>()
		.mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/.well-known/jwks.json")) {
				return Response.json({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] });
			}
			return Response.json({
				access_token: "plan-access",
				refresh_token: "plan-refresh",
				id_token: idToken(nonce),
				expires_in: 3600,
				scope: PLAN_SCOPES,
			});
		}), { preconnect: globalThis.fetch.preconnect });
	let callbackUrl: URL | undefined;
	const promptAdapter = promptAdapterWith(infoSpy);

	const credential = await loginWithPrompts(kit, "openai", promptAdapter, {
		chatGptPlanDeps: {
			fetch,
			now: () => NOW,
			chatGptLoopbackPorts: [0],
			agentName: "PickerTest",
			openUrl: async (url) => {
				callbackUrl = new URL(url);
				nonce = callbackUrl.searchParams.get("nonce") ?? "";
				expect(callbackUrl.searchParams.get("client_id")).toBe("dynamic_agent_client");
				expect(callbackUrl.searchParams.get("agent_name_hint")).toBe("PickerTest");
				expect(callbackUrl.searchParams.get("scope")).toContain(CHATGPT_PLAN_SCOPE);
				expect(callbackUrl.searchParams.get("resource")).toBe("https://api.openai.com/v1");
				const redirectUri = callbackUrl.searchParams.get("redirect_uri") ?? "";
				expect(new URL(redirectUri).pathname).toBe("/auth/callback");
				const successUrl = new URL(redirectUri);
				successUrl.searchParams.set("code", "plan-auth-code");
				successUrl.searchParams.set("state", callbackUrl.searchParams.get("state") ?? "");
				successUrl.searchParams.set("client_id", ISSUED);
				const response = await globalThis.fetch(successUrl);
				expect(response.status).toBe(200);
				return true;
			},
		},
	});
	const runtime = await kit.runtimeAuth("openai");

	expect(credential).toEqual(
		expect.objectContaining({
			type: "oauth-external",
			metadata: expect.objectContaining({
				adapter: "openai-chatgpt-plan",
				clientId: ISSUED,
				baseUrl: "https://api.openai.com/v1",
			}),
		}),
	);
	expect(promptAdapter.select).toHaveBeenCalledTimes(1);
	expect(infoSpy).toHaveBeenCalledWith(
		"ChatGPT plan sign-in opened in your browser. Approve plan usage there, then return here.",
	);
	expect(callbackUrl?.origin).toBe("https://auth.openai.com");
	expect(callbackUrl?.pathname).toBe("/api/accounts/authorize");
	expect(runtime.external).toEqual(
		expect.objectContaining({
			adapter: "openai-chatgpt-plan",
			accessToken: "plan-access",
		}),
	);
});

test("Legacy OpenAI Codex account OAuth stays available through loginOpenAiAccount", async () => {
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
	const provider = kit.getProvider("openai");

	const credential = await loginOpenAiAccount(kit, provider, { info: infoSpy }, {
		fetch,
		sleep: async () => {},
		now: () => 1000,
		openAiLoopbackTimeoutMs: 1,
		openUrl: async () => false,
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
	expect(infoSpy.mock.calls[2]?.[0]).toBe(
		"Open https://auth.openai.com/codex/device and enter code: OPENAI-CODE",
	);
});
