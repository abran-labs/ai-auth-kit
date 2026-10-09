import type { ConnectStep } from "../connect-protocol.js";
import type { ConnectPhase } from "./connect-state.js";
export declare function useStepPolling(phase: ConnectPhase, step: ConnectStep | undefined, poll: (flowId: string) => Promise<void>): void;
