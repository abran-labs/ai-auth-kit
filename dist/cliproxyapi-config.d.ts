export interface CliProxyServerConfigOptions {
    readonly port: number;
    readonly managementKey: string;
    readonly clientApiKeys: readonly string[];
    readonly authDir: string;
    readonly host?: string;
    readonly allowRemote?: boolean;
}
export declare function renderCliProxyServerConfig(options: CliProxyServerConfigOptions): string;
