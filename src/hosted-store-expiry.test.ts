import { expect, test } from "bun:test";
import { createMemoryPendingFlowStore } from "./hosted-store.js";

test("Given expired memory flows, when put or peek runs, then expired entries are pruned", async () => {
  const store = createMemoryPendingFlowStore();
  await store.put("flow-old", "tenant-a", "old", 1_000);
  await store.put("flow-new", "tenant-a", "fresh", Date.now() + 600_000);

  expect(await store.peek("flow-old", "tenant-a")).toBeUndefined();
  expect(await store.peek("flow-new", "tenant-a")).toBe("fresh");
});

test("Given more than the entry cap, when put runs, then the oldest entries are evicted", async () => {
  const store = createMemoryPendingFlowStore();
  const farFuture = Date.now() + 600_000;
  for (let index = 0; index < 10_002; index += 1) {
    await store.put(`flow-${index}`, "tenant-a", `value-${index}`, farFuture);
  }

  expect(await store.peek("flow-0", "tenant-a")).toBeUndefined();
  expect(await store.peek("flow-1", "tenant-a")).toBeUndefined();
  expect(await store.peek("flow-10001", "tenant-a")).toBe("value-10001");
});
