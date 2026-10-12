import { useEffect, useRef } from "react";
export function useStepPolling(phase, step, poll) {
    const pollTimer = useRef(undefined);
    const pollAbort = useRef(undefined);
    useEffect(() => {
        if (pollTimer.current !== undefined) {
            clearTimeout(pollTimer.current);
            pollTimer.current = undefined;
        }
        pollAbort.current?.abort();
        if (phase !== "step" || step === undefined || step.kind !== "working")
            return;
        const active = step;
        const controller = new AbortController();
        pollAbort.current = controller;
        pollTimer.current = setTimeout(() => {
            if (controller.signal.aborted)
                return;
            void poll(active.flowId);
        }, active.pollAfterMs);
        return () => {
            if (pollTimer.current !== undefined)
                clearTimeout(pollTimer.current);
            controller.abort();
        };
    }, [phase, poll, step]);
}
//# sourceMappingURL=use-step-polling.js.map