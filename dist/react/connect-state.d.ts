import type { ConnectModel, ConnectProvider, ConnectResponse, ConnectStatus, ConnectStep, Connection } from "../connect-protocol.js";
export type ConnectPhase = "loading" | "idle" | "method" | "step" | "models";
export interface ConnectState {
    readonly error?: string;
    readonly filter: string;
    readonly modelFilter: string;
    readonly models: readonly ConnectModel[];
    readonly modelsProviderId?: string;
    readonly phase: ConnectPhase;
    readonly provider?: ConnectProvider;
    readonly providers: readonly ConnectProvider[];
    readonly retryable: boolean;
    readonly showAll: boolean;
    readonly status?: ConnectStatus;
    readonly step?: ConnectStep;
    readonly working: boolean;
}
export type ConnectAction = {
    readonly kind: "load-started";
} | {
    readonly kind: "load-succeeded";
    readonly providers: readonly ConnectProvider[];
    readonly status: ConnectStatus;
} | {
    readonly kind: "load-failed";
    readonly message: string;
    readonly retryable: boolean;
} | {
    readonly kind: "show-all";
} | {
    readonly kind: "show-featured";
} | {
    readonly kind: "set-filter";
    readonly filter: string;
} | {
    readonly kind: "set-model-filter";
    readonly filter: string;
} | {
    readonly kind: "select-provider";
    readonly provider: ConnectProvider;
} | {
    readonly kind: "back-to-providers";
} | {
    readonly kind: "step-started";
} | {
    readonly kind: "step-arrived";
    readonly step: ConnectStep;
} | {
    readonly kind: "step-failed";
    readonly message: string;
    readonly retryable: boolean;
} | {
    readonly kind: "flow-cancelled";
} | {
    readonly kind: "models-arrived";
    readonly models: readonly ConnectModel[];
    readonly providerId: string;
} | {
    readonly kind: "models-failed";
    readonly message: string;
    readonly retryable: boolean;
} | {
    readonly kind: "open-models";
    readonly providerId: string;
} | {
    readonly kind: "model-selected";
} | {
    readonly kind: "disconnected";
} | {
    readonly kind: "clear-error";
};
export declare const initialConnectState: ConnectState;
export declare function connectReducer(state: ConnectState, action: ConnectAction): ConnectState;
export type ConnectSubmitInput = {
    readonly kind: "secret";
    readonly value: string;
} | {
    readonly kind: "redirect-url";
    readonly value: string;
} | {
    readonly kind: "confirm";
    readonly accepted: boolean;
};
export declare function responseError(response: ConnectResponse): {
    readonly message: string;
    readonly retryable: boolean;
} | undefined;
export declare function visibleProviders(providers: readonly ConnectProvider[], showAll: boolean, featuredOnlyInitially: boolean, filter: string): readonly ConnectProvider[];
export declare function hasChatgptPlanMethod(provider: ConnectProvider): boolean;
export declare function hasApiKeyMethod(provider: ConnectProvider): boolean;
export declare function responseFailure(response: ConnectResponse): {
    readonly message: string;
    readonly retryable: boolean;
};
export declare function readStepConnection(response: ConnectResponse): Connection | undefined;
