import { type JSX } from "react";
import type { ConnectMethod, ConnectProvider } from "../connect-protocol.js";
import type { ConnectPanelLabels } from "./ConnectPanel.js";
export declare function ProviderCatalog(properties: {
    readonly filter: string;
    readonly labels: Required<ConnectPanelLabels>;
    readonly onChoose: (provider: ConnectProvider) => void;
    readonly onFilter: (filter: string) => void;
    readonly providers: readonly ConnectProvider[];
}): JSX.Element;
export declare function MethodList(properties: {
    readonly backLabel: string;
    readonly onBack: () => void;
    readonly onStart: (providerId: string, method: ConnectMethod) => void;
    readonly provider: ConnectProvider;
}): JSX.Element;
