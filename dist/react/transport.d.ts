import { type ConnectRequest, type ConnectResponse } from "../connect-protocol.js";
export type ConnectTransport = (request: ConnectRequest) => Promise<ConnectResponse>;
export interface FetchConnectTransportOptions {
    readonly credentials?: RequestCredentials;
    readonly headers?: Record<string, string>;
    readonly timeoutMs?: number;
}
export declare function createFetchConnectTransport(url: string, init?: FetchConnectTransportOptions): ConnectTransport;
