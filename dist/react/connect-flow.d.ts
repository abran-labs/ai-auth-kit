import type { JSX } from "react";
import type { ConnectStep } from "../connect-protocol.js";
import { type StepSubmit } from "./step-views.js";
export declare function FlowView(properties: {
    readonly disabled: boolean;
    readonly step: ConnectStep;
    readonly submit: StepSubmit;
}): JSX.Element;
