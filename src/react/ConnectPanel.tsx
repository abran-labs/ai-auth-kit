import { useState, type JSX } from "react";
import type { Connection, SelectedModelSummary } from "../connect-protocol.js";
import { visibleProviders } from "./connect-state.js";
import { FlowView } from "./connect-flow.js";
import { ConnectionCard, ModelPickerView, StatusNotice } from "./entity-views.js";
import { FeaturedActions } from "./featured-providers.js";
import { MethodList, ProviderCatalog } from "./provider-catalog.js";
import type { StepSubmit } from "./step-views.js";
import type { ConnectTransport } from "./transport.js";
import { useConnect } from "./use-connect.js";

export interface ConnectPanelLabels {
	readonly back?: string;
	readonly cancel?: string;
	readonly changeModel?: string;
	readonly confirm?: string;
	readonly disconnect?: string;
	readonly keep?: string;
	readonly moreProviders?: string;
	readonly openSignIn?: string;
	readonly reconnect?: string;
	readonly retry?: string;
	readonly searchModels?: string;
	readonly searchProviders?: string;
	readonly submit?: string;
	readonly useApiKey?: string;
}

export interface ConnectPanelProps {
	readonly className?: string;
	readonly featuredOnlyInitially?: boolean;
	readonly labels?: ConnectPanelLabels;
	readonly onConnected?: (connection: Connection) => void;
	readonly onModelSelected?: (summary: SelectedModelSummary) => void;
	readonly title?: string;
	readonly transport: ConnectTransport;
}

const defaultLabels: Required<ConnectPanelLabels> = {
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

export function ConnectPanel(properties: ConnectPanelProps): JSX.Element {
	const labels = { ...defaultLabels, ...(properties.labels ?? {}) };
	const featuredOnly = properties.featuredOnlyInitially ?? true;
	const controller = useConnect(properties.transport, {
		onConnected: properties.onConnected,
		onModelSelected: properties.onModelSelected,
	});
	const { state } = controller;
	const [confirmDisconnect, setConfirmDisconnect] = useState<string | undefined>(undefined);
	const liveMessage =
		state.error ?? (state.phase === "loading" ? "Loading providers" : "Ready");
	const featured = state.providers.filter((provider) => provider.featured);
	const catalog = visibleProviders(
		state.providers,
		state.showAll || !featuredOnly,
		featuredOnly,
		state.filter,
	);
	const submit: StepSubmit = {
		onCancel: (flowId) => void controller.cancel(flowId),
		onConfirm: (flowId, accepted) =>
			void controller.submit(flowId, { accepted, kind: "confirm" }),
		onRedirect: (flowId, value) =>
			void controller.submit(flowId, { kind: "redirect-url", value }),
		onSecret: (flowId, value) => void controller.submit(flowId, { kind: "secret", value }),
	};
	const showCatalog =
		(state.phase === "idle" && (state.showAll || !featuredOnly)) ||
		state.phase === "method" ||
		state.phase === "step" ||
		state.phase === "models";

	return (
		<section className={properties.className ?? "aak-connect"} data-aak-panel="">
			<h2 data-aak-title="">{properties.title ?? "Connect AI"}</h2>
			<div aria-live="polite" data-aak-status="">
				{liveMessage}
			</div>
			{state.error === undefined ? null : (
				<StatusNotice
					message={state.error}
					onRetry={state.retryable ? () => void controller.refresh() : undefined}
					retryable={state.retryable}
				/>
			)}
			{state.phase === "loading" ? <span data-aak-loading="">Loading</span> : null}
			{state.status === undefined ? null : (
				<div data-aak-connections="">
					{state.status.connections.map((connection) => (
						<ConnectionCard
							connection={connection}
							key={connection.providerId}
							needsConfirm={confirmDisconnect === connection.providerId}
							onCancelDisconnect={() => {
								setConfirmDisconnect(undefined);
							}}
							onChangeModel={(providerId) => void controller.loadModels(providerId)}
							onDisconnect={(providerId) => {
								if (confirmDisconnect === providerId) {
									setConfirmDisconnect(undefined);
									void controller.disconnect(providerId);
								} else {
									setConfirmDisconnect(providerId);
								}
							}}
							onReconnect={(providerId) => {
								const provider = state.providers.find((entry) => entry.id === providerId);
								if (provider !== undefined) controller.choose(provider);
							}}
							selectedModel={
								state.status?.selectedModel?.providerId === connection.providerId
									? state.status?.selectedModel?.modelName
									: undefined
							}
						/>
					))}
				</div>
			)}
			{state.phase === "idle" ? (
				<div data-aak-featured="">
					{featured.map((provider) => (
						<FeaturedActions
							key={provider.id}
							labels={labels}
							onChoose={controller.choose}
							onStart={(providerId, method) => void controller.start(providerId, method)}
							provider={provider}
						/>
					))}
					{featuredOnly && !state.showAll ? (
						<button data-aak-more-toggle="" onClick={controller.showAll} type="button">
							{labels.moreProviders}
						</button>
					) : null}
				</div>
			) : null}
			{showCatalog ? (
				<ProviderCatalog
					filter={state.filter}
					labels={labels}
					onChoose={controller.choose}
					onFilter={controller.setFilter}
					providers={catalog}
				/>
			) : null}
			{state.phase === "method" && state.provider !== undefined ? (
				<MethodList
					backLabel={labels.back}
					onBack={controller.back}
					onStart={(providerId, method) => void controller.start(providerId, method)}
					provider={state.provider}
				/>
			) : null}
			{state.phase === "step" && state.step !== undefined ? (
				<FlowView
					disabled={state.working && state.error === undefined}
					step={state.step}
					submit={submit}
				/>
			) : null}
			{state.phase === "models" ? (
				<div data-aak-model-picker="">
					{state.working ? <span data-aak-loading="">Loading</span> : null}
					<ModelPickerView
						disabled={state.working}
						filter={state.modelFilter}
						models={state.models}
						onFilter={controller.setModelFilter}
						onSelect={(modelId) => {
							if (state.modelsProviderId !== undefined) {
								void controller.selectModel(state.modelsProviderId, modelId);
							}
						}}
					/>
					<button data-aak-back="" onClick={controller.back} type="button">
						{labels.back}
					</button>
				</div>
			) : null}
		</section>
	);
}
