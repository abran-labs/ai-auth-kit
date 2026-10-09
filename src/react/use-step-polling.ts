import { useEffect, useRef } from "react";
import type { ConnectStep } from "../connect-protocol.js";
import type { ConnectPhase } from "./connect-state.js";

export function useStepPolling(
	phase: ConnectPhase,
	step: ConnectStep | undefined,
	poll: (flowId: string) => Promise<void>,
): void {
	const pollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pollAbort = useRef<AbortController | undefined>(undefined);

	useEffect(() => {
		if (pollTimer.current !== undefined) {
			clearTimeout(pollTimer.current);
			pollTimer.current = undefined;
		}
		pollAbort.current?.abort();
		if (phase !== "step" || step === undefined || step.kind !== "working") return;
		const active = step;
		const controller = new AbortController();
		pollAbort.current = controller;
		pollTimer.current = setTimeout(() => {
			if (controller.signal.aborted) return;
			void poll(active.flowId);
		}, active.pollAfterMs);
		return () => {
			if (pollTimer.current !== undefined) clearTimeout(pollTimer.current);
			controller.abort();
		};
	}, [phase, poll, step]);
}
