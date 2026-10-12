import type { JSX } from "react";
import type { ConnectProvider } from "../connect-protocol.js";
import type { ConnectPanelLabels } from "./ConnectPanel.js";
export declare function FeaturedActions(properties: {
    readonly labels: Required<ConnectPanelLabels>;
    readonly onChoose: (provider: ConnectProvider) => void;
    readonly onStart: (providerId: string, method: "account" | "api-key") => void;
    readonly provider: ConnectProvider;
}): JSX.Element;
