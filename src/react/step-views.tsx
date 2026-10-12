import { useId, useState, type JSX } from "react";
import type { ConnectStep } from "../connect-protocol.js";

export interface StepSubmit {
	readonly onCancel: (flowId: string) => void;
	readonly onConfirm: (flowId: string, accepted: boolean) => void;
	readonly onRedirect: (flowId: string, value: string) => void;
	readonly onSecret: (flowId: string, value: string) => void;
}

function stepKind(step: ConnectStep): string {
	return step.kind;
}

export function SecretStepView(properties: {
	readonly disabled: boolean;
	readonly step: Extract<ConnectStep, { kind: "secret-input" }>;
	readonly submit: StepSubmit;
}): JSX.Element {
	const inputId = useId();
	const [secret, setSecret] = useState("");
	return (
		<form
			data-aak-step={stepKind(properties.step)}
			onSubmit={(event) => {
				event.preventDefault();
				properties.submit.onSecret(properties.step.flowId, secret);
				setSecret("");
			}}
		>
			<label htmlFor={inputId}>{properties.step.label}</label>
			<input
				autoFocus
				data-aak-secret-input=""
				disabled={properties.disabled}
				id={inputId}
				onChange={(event) => {
					setSecret(event.currentTarget.value);
				}}
				placeholder={properties.step.placeholder}
				type="password"
				value={secret}
			/>
			<button data-aak-secret-submit="" disabled={properties.disabled || secret === ""} type="submit">
				Submit
			</button>
			<button
				data-aak-cancel=""
				disabled={properties.disabled}
				onClick={() => {
					properties.submit.onCancel(properties.step.flowId);
				}}
				type="button"
			>
				Cancel
			</button>
		</form>
	);
}

export function ConfirmRiskView(properties: {
	readonly disabled: boolean;
	readonly step: Extract<ConnectStep, { kind: "confirm-risk" }>;
	readonly submit: StepSubmit;
}): JSX.Element {
	const checkboxId = useId();
	const [accepted, setAccepted] = useState(false);
	return (
		<form
			data-aak-step={stepKind(properties.step)}
			onSubmit={(event) => {
				event.preventDefault();
				properties.submit.onConfirm(properties.step.flowId, accepted);
			}}
		>
			<p data-aak-risk-message="">{properties.step.message}</p>
			<input
				autoFocus
				checked={accepted}
				data-aak-confirm-checkbox=""
				disabled={properties.disabled}
				id={checkboxId}
				onChange={(event) => {
					setAccepted(event.currentTarget.checked);
				}}
				type="checkbox"
			/>
			<label htmlFor={checkboxId}>I understand the risk</label>
			<button
				data-aak-confirm-submit=""
				disabled={properties.disabled || !accepted}
				type="submit"
			>
				Confirm
			</button>
			<button
				data-aak-confirm-cancel=""
				disabled={properties.disabled}
				onClick={() => {
					properties.submit.onCancel(properties.step.flowId);
				}}
				type="button"
			>
				Cancel
			</button>
		</form>
	);
}

export function RedirectPasteView(properties: {
	readonly disabled: boolean;
	readonly step: Extract<ConnectStep, { kind: "redirect-paste" }>;
	readonly submit: StepSubmit;
}): JSX.Element {
	const inputId = useId();
	const [value, setValue] = useState("");
	const matches = value === "" || value.startsWith(properties.step.callbackPrefix);
	return (
		<div data-aak-step={stepKind(properties.step)}>
			<button
				data-aak-open-signin=""
				onClick={() => {
					window.open(properties.step.authorizationUrl, "_blank", "noopener");
				}}
				type="button"
			>
				Open sign-in page
			</button>
			<p data-aak-redirect-instructions="">{properties.step.instructions}</p>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (value.startsWith(properties.step.callbackPrefix)) {
						properties.submit.onRedirect(properties.step.flowId, value);
						setValue("");
					}
				}}
			>
				<label htmlFor={inputId}>Paste the address from your browser</label>
				<input
					autoFocus
					data-aak-redirect-input=""
					disabled={properties.disabled}
					id={inputId}
					onChange={(event) => {
						setValue(event.currentTarget.value);
					}}
					type="text"
					value={value}
				/>
				{matches ? null : <span data-aak-error="">Address must start with the callback prefix</span>}
				<button
					data-aak-redirect-submit=""
					disabled={properties.disabled || !value.startsWith(properties.step.callbackPrefix)}
					type="submit"
				>
					Submit
				</button>
				<button
					data-aak-cancel=""
					disabled={properties.disabled}
					onClick={() => {
						properties.submit.onCancel(properties.step.flowId);
					}}
					type="button"
				>
					Cancel
				</button>
			</form>
			<span data-aak-redirect-expiry="" data-aak-muted="">
				Expires {properties.step.expiresAt}
			</span>
		</div>
	);
}

export function WorkingView(properties: {
	readonly onCancel: (flowId: string) => void;
	readonly step: Extract<ConnectStep, { kind: "working" }>;
}): JSX.Element {
	return (
		<div data-aak-step={stepKind(properties.step)} data-aak-working="">
			<span role="status">{properties.step.message}</span>
			<button
				data-aak-cancel=""
				onClick={() => {
					properties.onCancel(properties.step.flowId);
				}}
				type="button"
			>
				Cancel
			</button>
		</div>
	);
}
