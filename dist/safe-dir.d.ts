export declare class SafeDirectory {
    readonly fd: number;
    private readonly handle;
    private constructor();
    static openStorage(configDir: string, managedRoot: string): Promise<SafeDirectory>;
    path(): string;
    sync(): Promise<void>;
    close(): Promise<void>;
}
