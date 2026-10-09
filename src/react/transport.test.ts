import { afterEach, expect, test } from "bun:test";
import { createFetchConnectTransport } from "./transport.js";

const providersPayload = {
	kind: "providers",
	providers: [
		{
			featured: true,
			id: "openai",
			methods: [{ flow: "secret", label: "API key", method: "api-key" }],
			name: "OpenAI",
		},
	],
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function stubFetch(
	handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): void {
	const stub = Object.assign(handler, { preconnect: () => undefined });
	globalThis.fetch = stub satisfies typeof fetch;
}

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		headers: { "content-type": "application/json" },
		status: 200,
	});
}

test("Given a providers payload, when the fetch transport posts, then it returns parsed providers", async () => {
	// Given
	const seen: string[] = [];
	stubFetch(async (url: string | URL | Request, init?: RequestInit) => {
		seen.push(`${typeof url === "string" ? url : "url"}:${init?.method ?? "get"}`);
		return jsonResponse(providersPayload);
	});

	// When
	const response = await createFetchConnectTransport("https://host.invalid/connect")({
		op: "providers",
	});

	// Then
	expect(response.kind).toBe("providers");
	expect(seen).toEqual(["https://host.invalid/connect:POST"]);
	if (response.kind === "providers") {
		expect(response.providers.map((provider) => provider.id)).toEqual(["openai"]);
	}
});

test("Given a malformed payload, when the fetch transport posts, then it returns a synthetic internal error", async () => {
	// Given
	stubFetch(async () => jsonResponse({ kind: "unknown-shape" }));

	// When
	const response = await createFetchConnectTransport("https://host.invalid/connect")({
		op: "status",
	});

	// Then
	expect(response).toEqual({
		code: "internal",
		kind: "error",
		message: "connect service returned an unknown payload",
		retryable: true,
	});
});

test("Given invalid JSON, when the fetch transport posts, then it returns a synthetic internal error", async () => {
	// Given
	stubFetch(async () => new Response("not-json{", { status: 200 }));

	// When
	const response = await createFetchConnectTransport("https://host.invalid/connect")({
		op: "status",
	});

	// Then
	expect(response.kind).toBe("error");
	if (response.kind === "error") {
		expect(response.code).toBe("internal");
		expect(response.retryable).toBeTrue();
	}
});

test("Given a network failure, when the fetch transport posts, then it returns upstream_unavailable", async () => {
	// Given
	stubFetch(async () => {
		throw new TypeError("fetch failed");
	});

	// When
	const response = await createFetchConnectTransport("https://host.invalid/connect")({
		op: "status",
	});

	// Then
	expect(response).toEqual({
		code: "upstream_unavailable",
		kind: "error",
		message: "connect service unreachable",
		retryable: true,
	});
});

test("Given an aborting request, when the timeout fires, then it returns upstream_unavailable", async () => {
	// Given
	stubFetch(async (_url: string | URL | Request, init?: RequestInit) => {
		await new Promise<void>((_resolve, reject) => {
			init?.signal?.addEventListener("abort", () => {
				reject(new DOMException("aborted", "AbortError"));
			});
		});
		return jsonResponse(providersPayload);
	});

	// When
	const response = await createFetchConnectTransport("https://host.invalid/connect", {
		timeoutMs: 5,
	})({ op: "status" });

	// Then
	expect(response.kind).toBe("error");
	if (response.kind === "error") {
		expect(response.code).toBe("upstream_unavailable");
		expect(response.retryable).toBeTrue();
	}
});
