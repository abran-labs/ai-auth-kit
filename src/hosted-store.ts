import { emptyState } from "./storage.js";
import type { AuthKitState, AuthKitStorage, AuthKitStore, SecretStore } from "./types.js";

export interface HostedTenantStore {
  storage(tenantId: string): AuthKitStorage;
}

export interface PendingFlowStore {
  put(flowId: string, tenantId: string, value: string, expiresAt: number): Promise<void>;
  take(flowId: string, tenantId: string): Promise<string | undefined>;
  peek(flowId: string, tenantId: string): Promise<string | undefined>;
  delete(flowId: string, tenantId: string): Promise<void>;
}

class MemoryAuthKitStore implements AuthKitStore {
  private state: AuthKitState = emptyState();

  async read(): Promise<AuthKitState> {
    return {
      credentials: { ...this.state.credentials },
      ...(this.state.selectedModel === undefined ? {} : { selectedModel: this.state.selectedModel }),
      updatedAt: this.state.updatedAt,
    };
  }

  async write(state: AuthKitState): Promise<void> {
    this.state = {
      credentials: { ...state.credentials },
      ...(state.selectedModel === undefined ? {} : { selectedModel: state.selectedModel }),
      updatedAt: state.updatedAt,
    };
  }
}

class MemorySecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>();

  async get(ref: string): Promise<string | undefined> {
    return this.secrets.get(ref);
  }

  async set(ref: string, value: string): Promise<void> {
    this.secrets.set(ref, value);
  }

  async delete(ref: string): Promise<void> {
    this.secrets.delete(ref);
  }

  async reconcile(liveRefs: readonly string[]): Promise<void> {
    for (const ref of [...this.secrets.keys()]) {
      if (!liveRefs.includes(ref)) this.secrets.delete(ref);
    }
  }
}

function memoryAuthKitStorage(): AuthKitStorage {
  return { store: new MemoryAuthKitStore(), secrets: new MemorySecretStore() };
}

export function createMemoryTenantStore(): HostedTenantStore {
  const tenants = new Map<string, AuthKitStorage>();
  return {
    storage(tenantId: string): AuthKitStorage {
      const existing = tenants.get(tenantId);
      if (existing !== undefined) return existing;
      const created = memoryAuthKitStorage();
      tenants.set(tenantId, created);
      return created;
    },
  };
}

type PendingEntry = { readonly value: string; readonly expiresAt: number };

function pendingKey(flowId: string, tenantId: string): string {
  return `${tenantId.length}:${tenantId}:${flowId.length}:${flowId}`;
}

export function createMemoryPendingFlowStore(): PendingFlowStore {
  const flows = new Map<string, PendingEntry>();
  const MAX_ENTRIES = 10_000;

  function pruneExpired(now: number): void {
    for (const [key, entry] of flows) {
      if (entry.expiresAt <= now) flows.delete(key);
    }
  }

  function evictOldest(): void {
    while (flows.size > MAX_ENTRIES) {
      const oldest = flows.keys().next();
      if (oldest.done === true) return;
      flows.delete(oldest.value);
    }
  }

  return {
    async put(flowId: string, tenantId: string, value: string, expiresAt: number): Promise<void> {
      pruneExpired(Date.now());
      flows.delete(pendingKey(flowId, tenantId));
      flows.set(pendingKey(flowId, tenantId), { value, expiresAt });
      evictOldest();
    },
    async take(flowId: string, tenantId: string): Promise<string | undefined> {
      pruneExpired(Date.now());
      const entry = flows.get(pendingKey(flowId, tenantId));
      if (entry === undefined) return undefined;
      flows.delete(pendingKey(flowId, tenantId));
      return entry.value;
    },
    async peek(flowId: string, tenantId: string): Promise<string | undefined> {
      pruneExpired(Date.now());
      return flows.get(pendingKey(flowId, tenantId))?.value;
    },
    async delete(flowId: string, tenantId: string): Promise<void> {
      flows.delete(pendingKey(flowId, tenantId));
    },
  };
}
