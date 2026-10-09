import type { AuthKitStorage } from "./types.js";
export interface HostedTenantStore {
    storage(tenantId: string): AuthKitStorage;
}
export interface PendingFlowStore {
    put(flowId: string, tenantId: string, value: string, expiresAt: number): Promise<void>;
    take(flowId: string, tenantId: string): Promise<string | undefined>;
    peek(flowId: string, tenantId: string): Promise<string | undefined>;
    delete(flowId: string, tenantId: string): Promise<void>;
}
export declare function createMemoryTenantStore(): HostedTenantStore;
export declare function createMemoryPendingFlowStore(): PendingFlowStore;
