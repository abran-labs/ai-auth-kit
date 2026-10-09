import { useId, type JSX } from "react";
import type { ConnectModel, Connection } from "../connect-protocol.js";

export function StatusNotice(properties: {
	readonly message: string;
	readonly onRetry?: () => void;
	readonly retryable: boolean;
}): JSX.Element {
	return (
		<div data-aak-error="" role="alert">
			<span>{properties.message}</span>
			{properties.retryable && properties.onRetry !== undefined ? (
				<button data-aak-retry="" onClick={properties.onRetry} type="button">
					Retry
				</button>
			) : null}
		</div>
	);
}
export function ConnectionCard(properties: {
	readonly connection: Connection;
	readonly needsConfirm: boolean;
	readonly onCancelDisconnect: () => void;
	readonly onChangeModel: (providerId: string) => void;
	readonly onDisconnect: (providerId: string) => void;
	readonly onReconnect: (providerId: string) => void;
	readonly selectedModel?: string;
}): JSX.Element {
	const connection = properties.connection;
	return (
		<div data-aak-connection="" data-provider={connection.providerId}>
			<span data-aak-connection-name="">{connection.providerName}</span>
			{connection.account === undefined ? null : (
				<span data-aak-connection-account="">{connection.account}</span>
			)}
			{connection.health === "reconnect-required" ? (
				<span data-aak-health="reconnect-required">Reconnect needed</span>
			) : (
				<span data-aak-health="connected">Connected</span>
			)}
			{connection.usage === undefined ? null : (
				<span data-aak-usage="">
					Using ChatGPT plan{" "}
					<a data-aak-usage-link="" href={connection.usage.manageUrl}>
						Manage usage
					</a>
				</span>
			)}
			{properties.selectedModel === undefined ? null : (
				<span data-aak-model="">{properties.selectedModel}</span>
			)}
			<button
				data-aak-change-model=""
				onClick={() => {
					properties.onChangeModel(connection.providerId);
				}}
				type="button"
			>
				Change model
			</button>
			{connection.health === "reconnect-required" ? (
				<button
					data-aak-reconnect=""
					onClick={() => {
						properties.onReconnect(connection.providerId);
					}}
					type="button"
				>
					Reconnect
				</button>
			) : null}
			{properties.needsConfirm ? (
				<span data-aak-disconnect-confirm="">
					<button
						data-aak-disconnect-yes=""
						onClick={() => {
							properties.onDisconnect(connection.providerId);
						}}
						type="button"
					>
						Confirm disconnect
					</button>
					<button
						data-aak-disconnect-no=""
						onClick={properties.onCancelDisconnect}
						type="button"
					>
						Keep
					</button>
				</span>
			) : null}
			{properties.needsConfirm ? null : (
				<button
					data-aak-disconnect=""
					onClick={() => {
						properties.onDisconnect(connection.providerId);
					}}
					type="button"
				>
					Disconnect
				</button>
			)}
		</div>
	);
}

export function ModelPickerView(properties: {
	readonly disabled: boolean;
	readonly filter: string;
	readonly models: readonly ConnectModel[];
	readonly onFilter: (filter: string) => void;
	readonly onSelect: (modelId: string) => void;
}): JSX.Element {
	const filterId = useId();
	const query = properties.filter.trim().toLowerCase();
	const visible =
		query === ""
			? properties.models
			: properties.models.filter(
					(model) =>
						model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
				);
	return (
		<div data-aak-models="">
			<label htmlFor={filterId}>Search models</label>
			<input
				autoFocus
				data-aak-model-filter=""
				id={filterId}
				onChange={(event) => {
					properties.onFilter(event.currentTarget.value);
				}}
				type="text"
				value={properties.filter}
			/>
			<ul data-aak-model-list="">
				{visible.map((model) => (
					<li data-aak-model-option="" data-model={model.id} key={model.id}>
						<button
							data-aak-model-select=""
							disabled={properties.disabled}
							onClick={() => {
								properties.onSelect(model.id);
							}}
							type="button"
						>
							{model.name}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
