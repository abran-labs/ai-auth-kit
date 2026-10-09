import { expect, test } from "bun:test";
import { createMemoryPendingFlowStore, createMemoryTenantStore } from "./hosted-store.js";

test("Given a memory tenant store, when two tenants save state, then neither sees the other", async () => {
  const tenants = createMemoryTenantStore();

  await tenants.storage("guild-a").store.write({ credentials: {}, updatedAt: "2026-10-08T00:00:00.000Z" });
  await tenants.storage("guild-a").secrets.set("ref-a", "secret-a");

  expect((await tenants.storage("guild-b").store.read()).credentials).toEqual({});
  expect(await tenants.storage("guild-b").secrets.get("ref-a")).toBeUndefined();
  expect(tenants.storage("guild-a")).toBe(tenants.storage("guild-a"));
});

test("Given a memory tenant store, when secrets are reconciled, then orphaned refs are dropped", async () => {
  const tenants = createMemoryTenantStore();

  await tenants.storage("guild-a").secrets.set("live", "1");
  await tenants.storage("guild-a").secrets.set("orphan", "2");
  await tenants.storage("guild-a").secrets.reconcile(["live"]);

  expect(await tenants.storage("guild-a").secrets.get("live")).toBe("1");
  expect(await tenants.storage("guild-a").secrets.get("orphan")).toBeUndefined();
});

test("Given a pending flow store, when a flow is taken, then the read is one-time", async () => {
  const flows = createMemoryPendingFlowStore();

  await flows.put("flow-1", "guild-a", "{\"kind\":\"secret\"}", Date.now() + 600_000);
  expect(await flows.peek("flow-1", "guild-a")).toBe("{\"kind\":\"secret\"}");
  expect(await flows.take("flow-1", "guild-a")).toBe("{\"kind\":\"secret\"}");
  expect(await flows.peek("flow-1", "guild-a")).toBeUndefined();
  expect(await flows.take("flow-1", "guild-a")).toBeUndefined();
});

test("Given a pending flow store, when tenants share a flow id, then values stay isolated", async () => {
  const flows = createMemoryPendingFlowStore();

  await flows.put("shared", "guild-a", "value-a", 1);
  await flows.put("shared", "guild-b", "value-b", 2);
  expect(await flows.peek("shared", "guild-a")).toBe("value-a");
  await flows.delete("shared", "guild-a");
  expect(await flows.peek("shared", "guild-a")).toBeUndefined();
  expect(await flows.take("shared", "guild-b")).toBe("value-b");
});

test("Given a pending flow store, when a value is overwritten, then the latest value wins", async () => {
  const flows = createMemoryPendingFlowStore();

  await flows.put("flow-1", "guild-a", "first", 1);
  await flows.put("flow-1", "guild-a", "second", 2);
  expect(await flows.take("flow-1", "guild-a")).toBe("second");
});
