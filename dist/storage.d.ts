import type { AuthKitState, AuthKitStorage, AuthKitStore, ProjectStorageOptions, SecretStore } from "./types.js";
export declare function projectConfigDir(projectName: string, options?: ProjectStorageOptions): string;
export declare function globalConfigDir(appName?: string): string;
export declare function projectStorage(projectName: string, options?: ProjectStorageOptions): AuthKitStorage;
export declare function globalStorage(appName?: string): AuthKitStorage;
export declare function emptyState(): AuthKitState;
export declare class FileAuthKitStore implements AuthKitStore {
    private readonly configDir;
    private readonly managedRoot;
    readonly path: string;
    constructor(configDir: string, managedRoot?: string);
    read(): Promise<AuthKitState>;
    write(state: AuthKitState): Promise<void>;
}
export declare class FileSecretStore implements SecretStore {
    private readonly configDir;
    private readonly managedRoot;
    readonly path: string;
    constructor(configDir: string, managedRoot?: string);
    get(ref: string): Promise<string | undefined>;
    set(ref: string, value: string): Promise<void>;
    delete(ref: string): Promise<void>;
    reconcile(liveRefs: readonly string[]): Promise<void>;
    private readAll;
    private writeAll;
}
