import { expect, test } from "bun:test";
import { createAuthKit } from "./kit.js";
import type { AuthKitState, AuthKitStore, SecretStore } from "./types.js";

function empty(): AuthKitState {
  return { credentials: {}, updatedAt: "2026-10-09T00:00:00.000Z" };
}

class GatedStore implements AuthKitStore {
  private state: AuthKitState = empty();
  releaseWrite: () => void = () => undefined;
  private gate: Promise<void> = Promise.resolve();

  holdWrites(): void {
    let release: () => void = () => undefined;
    this.gate = new Promise<void>((resolve) => { release = resolve; });
    this.releaseWrite = release;
  }

  async read(): Promise<AuthKitState> {
    return { credentials: { ...this.state.credentials }, updatedAt: this.state.updatedAt };
  }

  async write(state: AuthKitState): Promise<void> {
    await this.gate;
    this.state = { credentials: { ...state.credentials }, updatedAt: state.updatedAt };
  }
}

class MemorySecrets implements SecretStore {
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

test("Given a slow state commit, when status reads concurrently, then the fresh secret survives reconcile", async () => {
  const store = new GatedStore();
  const secrets = new MemorySecrets();
  const kit = createAuthKit({
    storage: { store, secrets },
    providers: [{ id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key"], models: [] }],
  });
  store.holdWrites();

  const saving = kit.saveApiKey("openai", "sk-fresh");
  while ((await secrets.get("provider:openai:api-key")) === undefined) {
    await new Promise((resolve) => { setTimeout(resolve, 1); });
  }
  const statusPromise = kit.readState();
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  store.releaseWrite();
  const status = await statusPromise;
  await saving;

  expect(status.credentials.openai?.type).toBe("api-key");
  expect(await secrets.get("provider:openai:api-key")).toBe("sk-fresh");
  expect((await kit.getCredential("openai"))?.type).toBe("api-key");
});
