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

test("env login auto-saves single present shell credential", async () => {
	process.env.OPENAI_API_KEY = "sk-live";
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	let selectCallCount = 0;
	const select: PromptAdapter["select"] = async (options) => {
		selectCallCount += 1;
		return options.options.find((option) => option.value === "env")?.value ?? Symbol();
	};
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select,
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	const credential = await loginWithPrompts(kit, "openai", promptAdapter);

	expect(credential).toEqual(
		expect.objectContaining({ type: "env", envVar: "OPENAI_API_KEY" }),
	);
	expect(selectCallCount).toBe(1);
});
test("env login prompts when multiple shell credentials exist", async () => {
	process.env.GEMINI_API_KEY = "gem-test";
	process.env.GOOGLE_API_KEY = "google-test";
	const kit = createProjectAuthKit("test-tool", { rootDir: dir });
	const selectCalls: unknown[] = [];
	const selectedValues = ["env", "GOOGLE_API_KEY"];
	const select: PromptAdapter["select"] = async (options) => {
		selectCalls.push(options);
		const selectedValue = selectedValues[selectCalls.length - 1];
		return options.options.find((option) => String(option.value) === selectedValue)?.value ?? Symbol();
	};
	const promptAdapter: PromptAdapter = {
		isCancel: (value: unknown): value is symbol => typeof value === "symbol",
		autocomplete: vi.fn(),
		select,
		confirm: vi.fn(),
		password: vi.fn(),
		info: vi.fn(),
	};

	const credential = await loginWithPrompts(kit, "google", promptAdapter);

	expect(credential).toEqual(
		expect.objectContaining({ type: "env", envVar: "GOOGLE_API_KEY" }),
	);
	expect(selectCalls[1]).toEqual({
		message: "Choose shell credential",
		options: [
			{
				value: "GEMINI_API_KEY",
				label: "Use GEMINI_API_KEY from shell",
				hint: "Detected in current shell",
			},
			{
				value: "GOOGLE_API_KEY",
				label: "Use GOOGLE_API_KEY from shell",
				hint: "Detected in current shell",
			},
		],
	});
});
