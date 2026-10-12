import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConnectProvider, Connection } from "../connect-protocol.js";
import { ConnectPanel, type ConnectPanelLabels } from "./ConnectPanel.js";
import { ConnectionCard, ModelPickerView, StatusNotice } from "./entity-views.js";
import { FeaturedActions } from "./featured-providers.js";
import type { ConnectTransport } from "./transport.js";

const labels: Required<ConnectPanelLabels> = {
	back: "Back",
	cancel: "Cancel",
	changeModel: "Change model",
	confirm: "Confirm",
	disconnect: "Disconnect",
	keep: "Keep",
	moreProviders: "More providers",
	openSignIn: "Open sign-in page",
	reconnect: "Reconnect",
	retry: "Retry",
	searchModels: "Search models",
	searchProviders: "Search providers",
	submit: "Submit",
	useApiKey: "Use API key",
};

const openai: ConnectProvider = {
	featured: true,
	id: "openai",
	methods: [
		{ flow: "chatgpt-plan", label: "Sign in", method: "account" },
		{ flow: "secret", label: "API key", method: "api-key" },
	],
	name: "OpenAI",
};

const healthy: Connection = {
	account: "ada@example.invalid",
	connectedAt: "2026-10-01T00:00:00.000Z",
	health: "connected",
	method: "account",
	providerId: "openai",
	providerName: "OpenAI",
	usage: { kind: "chatgpt-plan", manageUrl: "https://chatgpt.com/settings/usage" },
};

const stale: Connection = {
	connectedAt: "2026-10-01T00:00:00.000Z",
	health: "reconnect-required",
	method: "api-key",
	providerId: "anthropic",
	providerName: "Anthropic",
};

const cardActions = {
	onCancelDisconnect: () => undefined,
	onChangeModel: () => undefined,
	onDisconnect: () => undefined,
	onReconnect: () => undefined,
};

test("Given a featured OpenAI provider, when rendered, then the ChatGPT button keeps its label", () => {
	// Given
	const element = createElement(FeaturedActions, {
		labels,
		onChoose: () => undefined,
		onStart: () => undefined,
		provider: openai,
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain("data-aak-chatgpt-continue");
	expect(markup).toContain("Continue with ChatGPT");
	expect(markup).toContain("data-aak-apikey");
});

test("Given a healthy plan connection, when rendered, then usage and model show", () => {
	// Given
	const element = createElement(ConnectionCard, {
		...cardActions,
		connection: healthy,
		needsConfirm: false,
		selectedModel: "GPT-5",
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-provider="openai"');
	expect(markup).toContain('data-aak-connection-account');
	expect(markup).toContain('data-aak-health="connected"');
	expect(markup).toContain('data-aak-usage-link');
	expect(markup).toContain('href="https://chatgpt.com/settings/usage"');
	expect(markup).toContain('data-aak-model');
	expect(markup).toContain('data-aak-disconnect');
});

test("Given a stale connection, when rendered, then a reconnect badge and button show", () => {
	// Given
	const element = createElement(ConnectionCard, {
		...cardActions,
		connection: stale,
		needsConfirm: false,
		selectedModel: undefined,
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain('data-aak-health="reconnect-required"');
	expect(markup).toContain("data-aak-reconnect");
});

test("Given disconnect confirmation, when rendered, then confirm and keep show", () => {
	// Given
	const element = createElement(ConnectionCard, {
		...cardActions,
		connection: stale,
		needsConfirm: true,
		selectedModel: undefined,
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain("data-aak-disconnect-confirm");
	expect(markup).toContain("data-aak-disconnect-yes");
	expect(markup).toContain("data-aak-disconnect-no");
});

test("Given models, when rendered, then the picker filters by attribute", () => {
	// Given
	const element = createElement(ModelPickerView, {
		disabled: false,
		filter: "",
		models: [
			{ id: "gpt-5", name: "GPT-5" },
			{ id: "claude-opus", name: "Claude Opus" },
		],
		onFilter: () => undefined,
		onSelect: () => undefined,
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain("data-aak-models");
	expect(markup).toContain("data-aak-model-filter");
	expect(markup).toContain('data-model="gpt-5"');
	expect(markup).toContain('data-model="claude-opus"');
	expect(markup).toContain("data-aak-model-select");
});

test("Given a retryable error, when rendered, then a retry button shows", () => {
	// Given
	const element = createElement(StatusNotice, {
		message: "busy",
		onRetry: () => undefined,
		retryable: true,
	});

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain("data-aak-error");
	expect(markup).toContain("data-aak-retry");
	expect(markup).toContain('role="alert"');
});

test("Given the panel, when rendered statically, then it exposes panel and live regions", () => {
	// Given
	const transport: ConnectTransport = async () => ({ kind: "cancelled" });
	const element = createElement(ConnectPanel, { transport });

	// When
	const markup = renderToStaticMarkup(element);

	// Then
	expect(markup).toContain("data-aak-panel");
	expect(markup).toContain("data-aak-title");
	expect(markup).toContain('aria-live="polite"');
	expect(markup).toContain("data-aak-loading");
});
