import { parseConnectResponse, type ConnectRequest, type ConnectResponse } from "../connect-protocol.js";

export type ConnectTransport = (request: ConnectRequest) => Promise<ConnectResponse>;

export interface FetchConnectTransportOptions {
	readonly credentials?: RequestCredentials;
	readonly headers?: Record<string, string>;
	readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function syntheticError(code: "internal" | "upstream_unavailable", message: string): ConnectResponse {
	return { kind: "error", code, message, retryable: true };
}

export function createFetchConnectTransport(
	url: string,
	init?: FetchConnectTransportOptions,
): ConnectTransport {
	const headers = { "content-type": "application/json", ...(init?.headers ?? {}) };
	const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	return async (request: ConnectRequest): Promise<ConnectResponse> => {
		const controller = new AbortController();
		const timer = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
		try {
			const response = await fetch(url, {
				body: JSON.stringify(request),
				credentials: init?.credentials,
				headers,
				method: "POST",
				signal: controller.signal,
			});
			const body: unknown = await response.json();
			return parseConnectResponse(body);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return syntheticError("upstream_unavailable", "connect request timed out");
			}
			if (error instanceof TypeError) {
				return syntheticError("upstream_unavailable", "connect service unreachable");
			}
			if (error instanceof SyntaxError) {
				return syntheticError("internal", "connect service returned malformed JSON");
			}
			if (error instanceof Error && error.name === "ZodError") {
				return syntheticError("internal", "connect service returned an unknown payload");
			}
			return syntheticError("internal", "connect service returned an unknown payload");
		} finally {
			clearTimeout(timer);
		}
	};
}
