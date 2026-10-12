import { type JSX } from "react";
import type { Connection, SelectedModelSummary } from "../connect-protocol.js";
import type { ConnectTransport } from "./transport.js";
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
export declare function ConnectPanel(properties: ConnectPanelProps): JSX.Element;
