import { useCallback, useEffect, useReducer, useRef } from "react";
import { connectReducer, initialConnectState, readStepConnection, responseFailure, } from "./connect-state.js";
import { useStepPolling } from "./use-step-polling.js";
export function useConnect(transport, options) {
    const [state, dispatch] = useReducer(connectReducer, initialConnectState);
    const mounted = useRef(true);
    const transportRef = useRef(transport);
    transportRef.current = transport;
    const callbacks = useRef(options);
    callbacks.current = options;
    const safeDispatch = useCallback((action) => {
        if (mounted.current)
            dispatch(action);
    }, []);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const refresh = useCallback(async () => {
        if (mounted.current)
            dispatch({ kind: "load-started" });
        const call = transportRef.current;
        const [providersResponse, statusResponse] = await Promise.all([
            call({ op: "providers" }),
            call({ op: "status" }),
        ]);
        if (!mounted.current)
            return;
        if (providersResponse.kind === "providers" && statusResponse.kind === "status") {
            dispatch({
                kind: "load-succeeded",
                providers: providersResponse.providers,
                status: statusResponse.status,
            });
            return;
        }
        const failure = providersResponse.kind === "error"
            ? { message: providersResponse.message, retryable: providersResponse.retryable }
            : responseFailure(statusResponse);
        dispatch({ kind: "load-failed", message: failure.message, retryable: failure.retryable });
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    const finishConnected = useCallback(async (connection) => {
        callbacks.current?.onConnected?.(connection);
        await refresh();
    }, [refresh]);
    const poll = useCallback(async (flowId) => {
        const response = await transportRef.current({ flowId, op: "poll" });
        if (!mounted.current)
            return;
        if (response.kind === "step") {
            dispatch({ kind: "step-arrived", step: response.step });
            const connection = readStepConnection(response);
            if (connection !== undefined)
                await finishConnected(connection);
            return;
        }
        if (response.kind === "cancelled") {
            dispatch({ kind: "flow-cancelled" });
            return;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
    }, [finishConnected]);
    useStepPolling(state.phase, state.step, poll);
    const start = useCallback(async (providerId, method) => {
        dispatch({ kind: "step-started" });
        const response = await transportRef.current({ method, op: "start", providerId });
        if (!mounted.current)
            return undefined;
        if (response.kind === "step") {
            dispatch({ kind: "step-arrived", step: response.step });
            const connection = readStepConnection(response);
            if (connection !== undefined)
                await finishConnected(connection);
            return connection;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
        return undefined;
    }, [finishConnected]);
    const submit = useCallback(async (flowId, input) => {
        dispatch({ kind: "step-started" });
        const response = await transportRef.current({ flowId, input, op: "submit" });
        if (!mounted.current)
            return undefined;
        if (response.kind === "step") {
            dispatch({ kind: "step-arrived", step: response.step });
            const connection = readStepConnection(response);
            if (connection !== undefined)
                await finishConnected(connection);
            return connection;
        }
        if (response.kind === "cancelled") {
            dispatch({ kind: "flow-cancelled" });
            return undefined;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
        return undefined;
    }, [finishConnected]);
    const cancel = useCallback(async (flowId) => {
        await transportRef.current({ flowId, op: "cancel" });
        if (!mounted.current)
            return;
        dispatch({ kind: "flow-cancelled" });
        await refresh();
    }, [refresh]);
    const loadModels = useCallback(async (providerId) => {
        dispatch({ kind: "open-models", providerId });
        const response = await transportRef.current({ op: "models", providerId });
        if (!mounted.current)
            return;
        if (response.kind === "models") {
            dispatch({ kind: "models-arrived", models: response.models, providerId });
            return;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "models-failed", message: failure.message, retryable: failure.retryable });
    }, []);
    const selectModel = useCallback(async (providerId, modelId) => {
        dispatch({ kind: "step-started" });
        const response = await transportRef.current({ modelId, op: "select-model", providerId });
        if (!mounted.current)
            return undefined;
        if (response.kind === "status") {
            dispatch({ kind: "model-selected" });
            await refresh();
            const summary = response.status.selectedModel;
            if (summary !== undefined)
                callbacks.current?.onModelSelected?.(summary);
            return summary;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "models-failed", message: failure.message, retryable: failure.retryable });
        return undefined;
    }, [refresh]);
    const disconnect = useCallback(async (providerId) => {
        dispatch({ kind: "step-started" });
        const response = await transportRef.current({ op: "disconnect", providerId });
        if (!mounted.current)
            return;
        if (response.kind === "status") {
            dispatch({ kind: "disconnected", status: response.status, ...(response.notice === undefined ? {} : { notice: response.notice }) });
            return;
        }
        const failure = responseFailure(response);
        dispatch({ kind: "step-failed", message: failure.message, retryable: failure.retryable });
    }, [refresh]);
    const back = useCallback(() => safeDispatch({ kind: "back-to-providers" }), [safeDispatch]);
    const choose = useCallback((provider) => {
        if (mounted.current)
            dispatch({ kind: "select-provider", provider });
    }, []);
    const clearError = useCallback(() => safeDispatch({ kind: "clear-error" }), [safeDispatch]);
    const setFilter = useCallback((filter) => {
        if (mounted.current)
            dispatch({ kind: "set-filter", filter });
    }, []);
    const setModelFilter = useCallback((filter) => {
        if (mounted.current)
            dispatch({ kind: "set-model-filter", filter });
    }, []);
    const showAll = useCallback(() => safeDispatch({ kind: "show-all" }), [safeDispatch]);
    const showFeatured = useCallback(() => safeDispatch({ kind: "show-featured" }), [safeDispatch]);
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
//# sourceMappingURL=use-connect.js.map