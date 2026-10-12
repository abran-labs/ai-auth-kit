import { useId, type JSX } from "react";
import type { ConnectMethod, ConnectProvider } from "../connect-protocol.js";
import type { ConnectPanelLabels } from "./ConnectPanel.js";

export function ProviderCatalog(properties: {
	readonly filter: string;
	readonly labels: Required<ConnectPanelLabels>;
	readonly onChoose: (provider: ConnectProvider) => void;
	readonly onFilter: (filter: string) => void;
	readonly providers: readonly ConnectProvider[];
}): JSX.Element {
	const filterId = useId();
	return (
		<div data-aak-catalog="">
			<label htmlFor={filterId}>{properties.labels.searchProviders}</label>
			<input
				data-aak-provider-filter=""
				id={filterId}
				onChange={(event) => {
					properties.onFilter(event.currentTarget.value);
				}}
				type="text"
				value={properties.filter}
			/>
			<ul data-aak-provider-list="">
				{properties.providers.map((provider) => (
					<li data-aak-provider-option="" data-provider={provider.id} key={provider.id}>
						<button
							data-aak-provider-button=""
							onClick={() => {
								properties.onChoose(provider);
							}}
							type="button"
						>
							{provider.name}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

export function MethodList(properties: {
	readonly backLabel: string;
	readonly onBack: () => void;
	readonly onStart: (providerId: string, method: ConnectMethod) => void;
	readonly provider: ConnectProvider;
}): JSX.Element {
	const provider = properties.provider;
	return (
		<div data-aak-method-list="">
			<span>{provider.name}</span>
			{provider.methods.map((option) => (
				<button
					data-aak-method-button=""
					data-flow={option.flow}
					data-method={option.method}
					key={`${option.method}:${option.flow}`}
					onClick={() => {
						properties.onStart(provider.id, option.method);
					}}
					type="button"
				>
					{option.label}
				</button>
			))}
			<button data-aak-back="" onClick={properties.onBack} type="button">
				{properties.backLabel}
			</button>
		</div>
	);
}
