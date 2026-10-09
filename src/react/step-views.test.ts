import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConnectStep } from "../connect-protocol.js";
import { FlowView } from "./connect-flow.js";
import { ConfirmRiskView, RedirectPasteView, SecretStepView, WorkingView } from "./step-views.js";

const secretStep: Extract<ConnectStep, { kind: "secret-input" }> = {
	flowId: "abcdefghij123456789012",
	kind: "secret-input",
	label: "API key",
	providerId: "openai",
};

const confirmStep: Extract<ConnectStep, { kind: "confirm-risk" }> = {
	flowId: "abcdefghij123456789012",
	kind: "confirm-risk",
	message: "Third-party proxy risk",
	providerId: "openai",
};

const redirectStep: Extract<ConnectStep, { kind: "redirect-paste" }> = {
	authorizationUrl: "https://accounts.example.invalid/authorize",
	callbackPrefix: "https://app.example.invalid/callback",
	expiresAt: "2026-10-08T01:00:00.000Z",
	flowId: "abcdefghij123456789012",
	instructions: "Sign in, then paste the redirected address.",
	kind: "redirect-paste",
	providerId: "openai",
};

const workingStep: Extract<ConnectStep, { kind: "working" }> = {
	flowId: "abcdefghij123456789012",
	kind: "working",
	message: "Waiting for approval",
	pollAfterMs: 1000,
	providerId: "openai",
};

const submit = {
	onCancel: () => undefined,
	onConfirm: () => undefined,
	onRedirect: () => undefined,
	onSecret: () => undefined,
};

test("Given a secret step, when rendered, then it shows a password input without the secret", () => {
	// Given
	const element = createElement(SecretStepView, { disabled: false, step: secretStep, submit });

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-aak-step="secret-input"');
	expect(markup).toContain('data-aak-secret-input');
	expect(markup).toContain('type="password"');
	expect(markup).toContain('data-aak-secret-submit');
	expect(markup).not.toContain("s3cr3t");
});

test("Given a confirm-risk step, when rendered, then it requires an explicit checkbox", () => {
	// Given
	const element = createElement(ConfirmRiskView, { disabled: false, step: confirmStep, submit });

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-aak-step="confirm-risk"');
	expect(markup).toContain('data-aak-confirm-checkbox');
	expect(markup).toContain('type="checkbox"');
	expect(markup).toContain('data-aak-confirm-submit');
	expect(markup).toContain("Third-party proxy risk");
});

test("Given a redirect step, when rendered, then it shows sign-in, instructions, and expiry", () => {
	// Given
	const element = createElement(RedirectPasteView, { disabled: false, step: redirectStep, submit });

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-aak-step="redirect-paste"');
	expect(markup).toContain('data-aak-open-signin');
	expect(markup).toContain("Sign in, then paste the redirected address.");
	expect(markup).toContain('data-aak-redirect-input');
	expect(markup).toContain('data-aak-redirect-expiry');
	expect(markup).toContain("2026-10-08T01:00:00.000Z");
});

test("Given a working step, when rendered, then it shows status with cancel", () => {
	// Given
	const element = createElement(WorkingView, { onCancel: () => undefined, step: workingStep });

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-aak-step="working"');
	expect(markup).toContain('data-aak-working');
	expect(markup).toContain('role="status"');
	expect(markup).toContain('data-aak-cancel');
});

test("Given each step kind, when routed through FlowView, then the step marker matches", () => {
	// Given
	const steps: readonly ConnectStep[] = [secretStep, confirmStep, redirectStep, workingStep];

	// When
	const markups = steps.map((step) =>
		renderToStaticMarkup(createElement(FlowView, { disabled: false, step, submit })),
	);

	// Then
	expect(markups[0]).toContain('data-aak-step="secret-input"');
	expect(markups[1]).toContain('data-aak-step="confirm-risk"');
	expect(markups[2]).toContain('data-aak-step="redirect-paste"');
	expect(markups[3]).toContain('data-aak-step="working"');
});
