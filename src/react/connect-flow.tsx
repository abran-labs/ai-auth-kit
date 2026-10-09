import type { JSX } from "react";
import type { ConnectStep } from "../connect-protocol.js";
import {
	ConfirmRiskView,
	RedirectPasteView,
	SecretStepView,
	WorkingView,
	type StepSubmit,
} from "./step-views.js";

export function FlowView(properties: {
	readonly disabled: boolean;
	readonly step: ConnectStep;
	readonly submit: StepSubmit;
}): JSX.Element {
	const step = properties.step;
	return (
		<div data-aak-flow="">
			{step.kind === "secret-input" ? (
				<SecretStepView disabled={properties.disabled} step={step} submit={properties.submit} />
			) : null}
			{step.kind === "confirm-risk" ? (
				<ConfirmRiskView disabled={properties.disabled} step={step} submit={properties.submit} />
			) : null}
			{step.kind === "redirect-paste" ? (
				<RedirectPasteView disabled={properties.disabled} step={step} submit={properties.submit} />
			) : null}
			{step.kind === "working" ? (
				<WorkingView onCancel={properties.submit.onCancel} step={step} />
			) : null}
			{step.kind === "connected" ? <span data-aak-step="connected">Connected</span> : null}
		</div>
	);
}
