import { type JSX } from "react";
import type { ConnectModel, Connection } from "../connect-protocol.js";
export declare function StatusNotice(properties: {
    readonly message: string;
    readonly onRetry?: () => void;
    readonly retryable: boolean;
}): JSX.Element;
export declare function ConnectionCard(properties: {
    readonly connection: Connection;
    readonly needsConfirm: boolean;
    readonly onCancelDisconnect: () => void;
    readonly onChangeModel: (providerId: string) => void;
    readonly onDisconnect: (providerId: string) => void;
    readonly onReconnect: (providerId: string) => void;
    readonly selectedModel?: string;
}): JSX.Element;
export declare function ModelPickerView(properties: {
    readonly disabled: boolean;
    readonly filter: string;
    readonly models: readonly ConnectModel[];
    readonly onFilter: (filter: string) => void;
    readonly onSelect: (modelId: string) => void;
}): JSX.Element;
