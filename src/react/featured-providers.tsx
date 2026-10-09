import type { JSX } from "react";
import type { ConnectProvider } from "../connect-protocol.js";
import { hasApiKeyMethod, hasChatgptPlanMethod } from "./connect-state.js";
import type { ConnectPanelLabels } from "./ConnectPanel.js";

export function FeaturedActions(properties: {
	readonly labels: Required<ConnectPanelLabels>;
	readonly onChoose: (provider: ConnectProvider) => void;
	readonly onStart: (providerId: string, method: "account" | "api-key") => void;
	readonly provider: ConnectProvider;
}): JSX.Element {
	const provider = properties.provider;
	if (hasChatgptPlanMethod(provider) || hasApiKeyMethod(provider)) {
		return (
			<div data-aak-featured-provider="" data-provider={provider.id}>
				<span>{provider.name}</span>
				{hasChatgptPlanMethod(provider) ? (
					<button
						data-aak-chatgpt-continue=""
						data-aak-primary=""
						onClick={() => {
							properties.onStart(provider.id, "account");
						}}
						type="button"
					>
						Continue with ChatGPT
					</button>
				) : null}
				{hasApiKeyMethod(provider) ? (
					<button
						data-aak-apikey=""
						onClick={() => {
							properties.onStart(provider.id, "api-key");
						}}
						type="button"
					>
						{properties.labels.useApiKey}
					</button>
				) : null}
			</div>
		);
	}
	return (
		<button
			data-aak-provider-button=""
			data-provider={provider.id}
			onClick={() => {
				properties.onChoose(provider);
			}}
			type="button"
		>
			{provider.name}
		</button>
	);
}
