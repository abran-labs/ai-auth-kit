import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
	ConnectMethod,
	Connection,
	ConnectProvider,
	ConnectStatus,
	SelectedModelSummary,
} from "../connect-protocol.js";
import {
	connectReducer,
	initialConnectState,
	readStepConnection,
	responseFailure,
	type ConnectState,
	type ConnectSubmitInput,
} from "./connect-state.js";
import type { ConnectTransport } from "./transport.js";
import { useStepPolling } from "./use-step-polling.js";

export interface ConnectController {
	readonly back: () => void;
	readonly cancel: (flowId: string) => Promise<void>;
	readonly choose: (provider: ConnectProvider) => void;
	readonly clearError: () => void;
	readonly disconnect: (providerId: string) => Promise<void>;
	readonly loadModels: (providerId: string) => Promise<void>;
	readonly refresh: () => Promise<void>;
	readonly selectModel: (providerId: string, modelId: string) => Promise<SelectedModelSummary | undefined>;
	readonly setFilter: (filter: string) => void;
	readonly setModelFilter: (filter: string) => void;
	readonly showAll: () => void;
	readonly showFeatured: () => void;
	readonly start: (providerId: string, method: ConnectMethod) => Promise<Connection | undefined>;
	readonly state: ConnectState;
	readonly submit: (flowId: string, input: ConnectSubmitInput) => Promise<Connection | undefined>;
}

export function useConnect(
	transport: ConnectTransport,
	options?: {
		readonly onConnected?: (connection: Connection) => void;
		readonly onModelSelected?: (summary: SelectedModelSummary) => void;
	},
): ConnectController {
	const [state, dispatch] = useReducer(connectReducer, initialConnectState);
	const mounted = useRef(true);
	const transportRef = useRef(transport);
	transportRef.current = transport;
	const callbacks = useRef(options);
	callbacks.current = options;

	const safeDispatch = useCallback((action: {
		readonly kind: "back-to-providers" | "clear-error" | "show-all" | "show-featured";
	}): void => {
		if (mounted.current) dispatch(action);
	}, []);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const refresh = useCallback(async (): Promise<void> => {
		if (mounted.current) dispatch({ kind: "load-started" });
		const call = transportRef.current;
		const [providersResponse, statusResponse] = await Promise.all([
			call({ op: "providers" }),
			call({ op: "status" }),
		]);
		if (!mounted.current) return;
		if (providersResponse.kind === "providers" && statusResponse.kind === "status") {
			dispatch({
				kind: "load-succeeded",
				providers: providersResponse.providers,
				status: statusResponse.status satisfies ConnectStatus,
			});
			return;
		}
		const failure =
			providersResponse.kind === "error"
				? { message: providersResponse.message, retryable: providersResponse.retryable }
				: responseFailure(statusResponse);
		dispatch({ kind: "load-failed", message: failure.message, retryable: failure.retryable });
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const finishConnected = useCallback(
		async (connection: Connection): Promise<void> => {
			callbacks.current?.onConnected?.(connection);
			await refresh();
		},
		[refresh],
	);

	const poll = useCallback(
		async (flowId: string): Promise<void> => {
			const response = await transportRef.current({ flowId, op: "poll" });
			if (!mounted.current) return;
			if (response.kind === "step") {
				dispatch({ kind: "step-arrived", step: response.step });
				const connection = readStepConnection(response);
				if (connection !== undefined) await finishConnected(connection);
				return;
			}
			if (response.kind === "cancelled") {
				dispatch({ kind: "flow-cancelled" });
				return;
			}
			const failure = responseFailure(response);
			dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
		},
		[finishConnected],
	);

	useStepPolling(state.phase, state.step, poll);

	const start = useCallback(
		async (providerId: string, method: ConnectMethod): Promise<Connection | undefined> => {
			dispatch({ kind: "step-started" });
			const response = await transportRef.current({ method, op: "start", providerId });
			if (!mounted.current) return undefined;
			if (response.kind === "step") {
				dispatch({ kind: "step-arrived", step: response.step });
				const connection = readStepConnection(response);
				if (connection !== undefined) await finishConnected(connection);
				return connection;
			}
			const failure = responseFailure(response);
			dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
			return undefined;
		},
		[finishConnected],
	);

	const submit = useCallback(
		async (flowId: string, input: ConnectSubmitInput): Promise<Connection | undefined> => {
			dispatch({ kind: "step-started" });
			const response = await transportRef.current({ flowId, input, op: "submit" });
			if (!mounted.current) return undefined;
			if (response.kind === "step") {
				dispatch({ kind: "step-arrived", step: response.step });
				const connection = readStepConnection(response);
				if (connection !== undefined) await finishConnected(connection);
				return connection;
			}
			if (response.kind === "cancelled") {
				dispatch({ kind: "flow-cancelled" });
				return undefined;
			}
			const failure = responseFailure(response);
			dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
			return undefined;
		},
		[finishConnected],
	);

	const cancel = useCallback(
		async (flowId: string): Promise<void> => {
			await transportRef.current({ flowId, op: "cancel" });
			if (!mounted.current) return;
			dispatch({ kind: "flow-cancelled" });
			await refresh();
		},
		[refresh],
	);

	const loadModels = useCallback(async (providerId: string): Promise<void> => {
		dispatch({ kind: "open-models", providerId });
		const response = await transportRef.current({ op: "models", providerId });
		if (!mounted.current) return;
		if (response.kind === "models") {
			dispatch({ kind: "models-arrived", models: response.models, providerId });
			return;
		}
		const failure = responseFailure(response);
		dispatch({ kind: "models-failed", message: failure.message, retryable: failure.retryable });
	}, []);

	const selectModel = useCallback(
		async (providerId: string, modelId: string): Promise<SelectedModelSummary | undefined> => {
			dispatch({ kind: "step-started" });
			const response = await transportRef.current({ modelId, op: "select-model", providerId });
			if (!mounted.current) return undefined;
			if (response.kind === "status") {
				dispatch({ kind: "model-selected" });
				await refresh();
				const summary = response.status.selectedModel;
				if (summary !== undefined) callbacks.current?.onModelSelected?.(summary);
				return summary;
			}
			const failure = responseFailure(response);
			dispatch({ kind: "models-failed", message: failure.message, retryable: failure.retryable });
			return undefined;
		},
		[refresh],
	);

	const disconnect = useCallback(
		async (providerId: string): Promise<void> => {
			dispatch({ kind: "step-started" });
			const response = await transportRef.current({ op: "disconnect", providerId });
			if (!mounted.current) return;
			if (response.kind === "status") {
				dispatch({ kind: "disconnected", status: response.status, ...(response.notice === undefined ? {} : { notice: response.notice }) });
				return;
			}
			const failure = responseFailure(response);
			dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
		},
		[refresh],
	);

	const back = useCallback((): void => safeDispatch({ kind: "back-to-providers" }), [safeDispatch]);
	const choose = useCallback(
		(provider: ConnectProvider): void => {
			if (mounted.current) dispatch({ kind: "select-provider", provider });
		},
		[],
	);
	const clearError = useCallback((): void => safeDispatch({ kind: "clear-error" }), [safeDispatch]);
	const setFilter = useCallback(
		(filter: string): void => {
			if (mounted.current) dispatch({ kind: "set-filter", filter });
		},
		[],
	);
	const setModelFilter = useCallback(
		(filter: string): void => {
			if (mounted.current) dispatch({ kind: "set-model-filter", filter });
		},
		[],
	);
	const showAll = useCallback((): void => safeDispatch({ kind: "show-all" }), [safeDispatch]);
	const showFeatured = useCallback(
		(): void => safeDispatch({ kind: "show-featured" }),
		[safeDispatch],
	);

	return {
		back,
		cancel,
		choose,
		clearError,
		disconnect,
		loadModels,
		refresh,
		selectModel,
		setFilter,
		setModelFilter,
		showAll,
		showFeatured,
		start,
		state,
		submit,
	};
}
