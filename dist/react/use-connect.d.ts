import type { ConnectMethod, Connection, ConnectProvider, SelectedModelSummary } from "../connect-protocol.js";
import { type ConnectState, type ConnectSubmitInput } from "./connect-state.js";
import type { ConnectTransport } from "./transport.js";
export interface ConnectController {
    readonly back: () => void;
    readonly cancel: (flowId: string) => Promise<void>;
    readonly choose: (provider: ConnectProvider) => void;
    readonly clearError: () => void;
    readonly disconnect: (providerId: string) => Promise<void>;
    readonly loadModels: (providerId: string) => Promise<void>;
    readonly refresh: () => Promise<void>;
    readonly selectModel: (providerId: string, modelId: string) => Promise<SelectedModelSummary | undefined>;
    readonly setFilter: (filter: string) => void;
    readonly setModelFilter: (filter: string) => void;
    readonly showAll: () => void;
    readonly showFeatured: () => void;
    readonly start: (providerId: string, method: ConnectMethod) => Promise<Connection | undefined>;
    readonly state: ConnectState;
    readonly submit: (flowId: string, input: ConnectSubmitInput) => Promise<Connection | undefined>;
}
export declare function useConnect(transport: ConnectTransport, options?: {
    readonly onConnected?: (connection: Connection) => void;
    readonly onModelSelected?: (summary: SelectedModelSummary) => void;
}): ConnectController;
