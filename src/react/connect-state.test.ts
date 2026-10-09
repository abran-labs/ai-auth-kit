import { expect, test } from "bun:test";
import type { ConnectProvider, ConnectStatus } from "../connect-protocol.js";
import {
	connectReducer,
	hasApiKeyMethod,
	hasChatgptPlanMethod,
	initialConnectState,
	readStepConnection,
	responseFailure,
	visibleProviders,
	type ConnectState,
} from "./connect-state.js";

const openai: ConnectProvider = {
	featured: true,
	id: "openai",
	methods: [
		{ flow: "chatgpt-plan", label: "Sign in", method: "account" },
		{ flow: "secret", label: "API key", method: "api-key" },
	],
	name: "OpenAI",
};

const anthropic: ConnectProvider = {
	featured: false,
	id: "anthropic",
	methods: [{ flow: "secret", label: "API key", method: "api-key" }],
	name: "Anthropic",
};

const status: ConnectStatus = { connections: [] };

function loaded(): ConnectState {
	return connectReducer(initialConnectState, {
		kind: "load-succeeded",
		providers: [openai, anthropic],
		status,
	});
}

test("Given initial state, when loading succeeds, then the machine is idle with providers", () => {
	// Given
	const start = initialConnectState;

	// When
	const next = connectReducer(start, { kind: "load-succeeded", providers: [openai], status });

	// Then
	expect(next.phase).toBe("idle");
	expect(next.providers).toHaveLength(1);
	expect(next.working).toBeFalse();
});

test("Given a load failure, when retryable, then the error keeps a retry flag", () => {
	// Given
	const start = initialConnectState;

	// When
	const next = connectReducer(start, { kind: "load-failed", message: "down", retryable: true });

	// Then
	expect(next.error).toBe("down");
	expect(next.retryable).toBeTrue();
});

test("Given idle, when a provider is selected, then the machine shows its methods", () => {
	// Given
	const start = loaded();

	// When
	const next = connectReducer(start, { kind: "select-provider", provider: openai });

	// Then
	expect(next.phase).toBe("method");
	expect(next.provider?.id).toBe("openai");
});

test("Given a working step, when it arrives, then the machine stays busy", () => {
	// Given
	const start = loaded();

	// When
	const next = connectReducer(start, {
		kind: "step-arrived",
		step: { flowId: "abcdefghij123456789012", kind: "working", message: "wait", pollAfterMs: 500, providerId: "openai" },
	});

	// Then
	expect(next.phase).toBe("step");
	expect(next.working).toBeTrue();
	expect(next.step?.kind).toBe("working");
});

test("Given a secret step, when it arrives, then the machine is not busy", () => {
	// Given
	const start = loaded();

	// When
	const next = connectReducer(start, {
		kind: "step-arrived",
		step: { flowId: "abcdefghij123456789012", kind: "secret-input", label: "Key", providerId: "openai" },
	});

	// Then
	expect(next.phase).toBe("step");
	expect(next.working).toBeFalse();
});

test("Given a step failure, when retryable, then the step stays visible with an error", () => {
	// Given
	const working = connectReducer(loaded(), {
		kind: "step-arrived",
		step: { flowId: "abcdefghij123456789012", kind: "working", message: "wait", pollAfterMs: 500, providerId: "openai" },
	});

	// When
	const next = connectReducer(working, { kind: "step-failed", message: "busy", retryable: true });

	// Then
	expect(next.phase).toBe("step");
	expect(next.error).toBe("busy");
	expect(next.retryable).toBeTrue();
});

test("Given a flow, when cancelled, then the machine returns to idle", () => {
	// Given
	const working = connectReducer(loaded(), {
		kind: "step-arrived",
		step: { flowId: "abcdefghij123456789012", kind: "working", message: "wait", pollAfterMs: 500, providerId: "openai" },
	});

	// When
	const next = connectReducer(working, { kind: "flow-cancelled" });

	// Then
	expect(next.phase).toBe("idle");
	expect(next.step).toBeUndefined();
});

test("Given models, when they arrive, then the machine opens model picking", () => {
	// Given
	const start = loaded();

	// When
	const next = connectReducer(start, {
		kind: "models-arrived",
		models: [{ id: "gpt-5", name: "GPT-5" }],
		providerId: "openai",
	});

	// Then
	expect(next.phase).toBe("models");
	expect(next.models).toHaveLength(1);
	expect(next.modelsProviderId).toBe("openai");
});

test("Given featured-only mode, when listed, then only featured providers show", () => {
	// Given
	const providers = [openai, anthropic];

	// When
	const featured = visibleProviders(providers, false, true, "");
	const all = visibleProviders(providers, true, true, "");
	const filtered = visibleProviders(providers, true, true, "anth");

	// Then
	expect(featured.map((provider) => provider.id)).toEqual(["openai"]);
	expect(all.map((provider) => provider.id)).toEqual(["openai", "anthropic"]);
	expect(filtered.map((provider) => provider.id)).toEqual(["anthropic"]);
});

test("Given method options, when inspected, then chatgpt-plan and api-key are detected", () => {
	// Given / When / Then
	expect(hasChatgptPlanMethod(openai)).toBeTrue();
	expect(hasChatgptPlanMethod(anthropic)).toBeFalse();
	expect(hasApiKeyMethod(openai)).toBeTrue();
	expect(hasApiKeyMethod(anthropic)).toBeTrue();
});

test("Given an error response, when read, then its message and flag survive", () => {
	// Given
	const response = { code: "credential_rejected", kind: "error", message: "bad key", retryable: false } as const;

	// When
	const failure = responseFailure(response);

	// Then
	expect(failure).toEqual({ message: "bad key", retryable: false });
});

test("Given a connected step, when read, then the connection is extracted", () => {
	// Given
	const response = {
		kind: "step",
		step: {
			connection: {
				connectedAt: "2026-01-01T00:00:00.000Z",
				health: "connected",
				method: "api-key",
				providerId: "openai",
				providerName: "OpenAI",
			},
			kind: "connected",
		},
	} as const;

	// When
	const connection = readStepConnection(response);

	// Then
	expect(connection?.providerId).toBe("openai");
});
