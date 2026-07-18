export type CliProxyApiFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>;
export interface TransportOptions {
    readonly timeoutMs?: number;
    readonly deadline?: number;
}
export declare class CliProxyTransportError extends Error {
}
export declare function boundedRequest(fetchImpl: CliProxyApiFetch, start: string, maximum: number, api: boolean, options?: TransportOptions): Promise<Uint8Array>;
