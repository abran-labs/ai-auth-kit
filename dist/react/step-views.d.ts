import { type JSX } from "react";
import type { ConnectStep } from "../connect-protocol.js";
export interface StepSubmit {
    readonly onCancel: (flowId: string) => void;
    readonly onConfirm: (flowId: string, accepted: boolean) => void;
    readonly onRedirect: (flowId: string, value: string) => void;
    readonly onSecret: (flowId: string, value: string) => void;
}
export declare function SecretStepView(properties: {
    readonly disabled: boolean;
    readonly step: Extract<ConnectStep, {
        kind: "secret-input";
    }>;
    readonly submit: StepSubmit;
}): JSX.Element;
export declare function ConfirmRiskView(properties: {
    readonly disabled: boolean;
    readonly step: Extract<ConnectStep, {
        kind: "confirm-risk";
    }>;
    readonly submit: StepSubmit;
}): JSX.Element;
export declare function RedirectPasteView(properties: {
    readonly disabled: boolean;
    readonly step: Extract<ConnectStep, {
        kind: "redirect-paste";
    }>;
    readonly submit: StepSubmit;
}): JSX.Element;
export declare function WorkingView(properties: {
    readonly onCancel: (flowId: string) => void;
    readonly step: Extract<ConnectStep, {
        kind: "working";
    }>;
}): JSX.Element;
