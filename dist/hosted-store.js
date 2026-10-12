import { emptyState } from "./storage.js";
class MemoryAuthKitStore {
    state = emptyState();
    async read() {
        return {
            credentials: { ...this.state.credentials },
            ...(this.state.selectedModel === undefined ? {} : { selectedModel: this.state.selectedModel }),
            updatedAt: this.state.updatedAt,
        };
    }
    async write(state) {
        this.state = {
            credentials: { ...state.credentials },
            ...(state.selectedModel === undefined ? {} : { selectedModel: state.selectedModel }),
            updatedAt: state.updatedAt,
        };
    }
}
class MemorySecretStore {
    secrets = new Map();
    async get(ref) {
        return this.secrets.get(ref);
    }
    async set(ref, value) {
        this.secrets.set(ref, value);
    }
    async delete(ref) {
        this.secrets.delete(ref);
    }
    async reconcile(liveRefs) {
        for (const ref of [...this.secrets.keys()]) {
            if (!liveRefs.includes(ref))
                this.secrets.delete(ref);
        }
    }
}
function memoryAuthKitStorage() {
    return { store: new MemoryAuthKitStore(), secrets: new MemorySecretStore() };
}
export function createMemoryTenantStore() {
    const tenants = new Map();
    return {
        storage(tenantId) {
            const existing = tenants.get(tenantId);
            if (existing !== undefined)
                return existing;
            const created = memoryAuthKitStorage();
            tenants.set(tenantId, created);
            return created;
        },
    };
}
function pendingKey(flowId, tenantId) {
    return `${tenantId.length}:${tenantId}:${flowId.length}:${flowId}`;
}
export function createMemoryPendingFlowStore() {
    const flows = new Map();
    const MAX_ENTRIES = 10_000;
    function pruneExpired(now) {
        for (const [key, entry] of flows) {
            if (entry.expiresAt <= now)
                flows.delete(key);
        }
    }
    function evictOldest() {
        while (flows.size > MAX_ENTRIES) {
            const oldest = flows.keys().next();
            if (oldest.done === true)
                return;
            flows.delete(oldest.value);
        }
    }
    return {
        async put(flowId, tenantId, value, expiresAt) {
            pruneExpired(Date.now());
            flows.delete(pendingKey(flowId, tenantId));
            flows.set(pendingKey(flowId, tenantId), { value, expiresAt });
            evictOldest();
        },
        async take(flowId, tenantId) {
            pruneExpired(Date.now());
            const entry = flows.get(pendingKey(flowId, tenantId));
            if (entry === undefined)
                return undefined;
            flows.delete(pendingKey(flowId, tenantId));
            return entry.value;
        },
        async peek(flowId, tenantId) {
            pruneExpired(Date.now());
            return flows.get(pendingKey(flowId, tenantId))?.value;
        },
        async delete(flowId, tenantId) {
            flows.delete(pendingKey(flowId, tenantId));
        },
    };
}
//# sourceMappingURL=hosted-store.js.map