import { expect, test } from "bun:test";
import {
  createCliProxyAccountConnector,
  createMemoryLoginSlot,
  defaultCliProxyRoutePrefix,
  type CliProxyLoginSlot,
} from "./cliproxyapi-connector.js";
import type { CliProxyManagementFetch } from "./cliproxyapi-management.js";
import { ProxyAccountError, type ProxyAccountErrorCode } from "./hosted-types.js";

const BASE_URL = "http://127.0.0.1:8317";
const MANAGEMENT_KEY = "test-management-key";
const CLIENT_KEY = "test-client-key";
const NOW = 1_700_000_000_000;
const SESSION_TTL_MS = 5 * 60 * 1000;

interface FakeFile { name: string; email: string; prefix: string; createdAt: string }
interface FakeSession { done: boolean; failed?: string }
interface FakeBackend {
  readonly fetch: CliProxyManagementFetch;
  readonly files: FakeFile[];
  readonly sessions: Map<string, FakeSession>;
  readonly tracker: { lastState: string; failPatch: boolean };
  readonly patched: { readonly name: string; readonly prefix: string }[];
  readonly deleted: string[];
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function entry(file: FakeFile): unknown {
  return { id: file.name, auth_index: "idx", name: file.name, type: "claude", provider: "claude", label: file.name, status: "active", disabled: false, email: file.email, created_at: file.createdAt };
}

function backend(): FakeBackend {
  const files: FakeFile[] = [];
  const sessions = new Map<string, FakeSession>();
  const patched: { name: string; prefix: string }[] = [];
  const deleted: string[] = [];
  const tracker: { lastState: string; failPatch: boolean } = { lastState: "", failPatch: false };
  let sequence = 0;
  const fetch: CliProxyManagementFetch = async (input, init) => {
    const url = new URL(input);
    if (new Headers(init?.headers).get("Authorization") !== `Bearer ${MANAGEMENT_KEY}`) return json({ error: "forbidden" }, 401);
    const method = init?.method ?? "GET";
    if (method === "GET" && url.pathname === "/v8/management/oauth/auth-url") {
      sequence += 1;
      tracker.lastState = `st-${sequence}`;
      sessions.set(tracker.lastState, { done: false });
      return json({ status: "ok", url: `https://claude.ai/oauth?state=${tracker.lastState}`, state: tracker.lastState });
    }
    if (method === "POST" && url.pathname === "/v8/management/oauth/callback") {
      const body: { provider?: unknown; redirect_url?: unknown } = JSON.parse(typeof init?.body === "string" ? init.body : "");
      const redirect = new URL(String(body.redirect_url ?? ""));
      const key = redirect.searchParams.get("state") ?? "";
      const session = sessions.get(key);
      if (session === undefined) return json({ error: "unknown or expired state" }, 404);
      const failure = redirect.searchParams.get("error");
      if (failure !== null) {
        session.failed = failure;
        return json({ status: "ok" });
      }
      session.done = true;
      files.push({ name: `claude-new-user${sequence}@example.com.json`, email: `user${sequence}@example.com`, prefix: "", createdAt: new Date(NOW).toISOString() });
      return json({ status: "ok" });
    }
    if (method === "GET" && url.pathname === "/v8/management/oauth/status") {
      const session = sessions.get(url.searchParams.get("state") ?? "");
      if (session === undefined) return json({ status: "error", error: "unknown or expired state" });
      if (session.failed !== undefined) return json({ status: "error", error: session.failed });
      return json(session.done ? { status: "ok" } : { status: "wait" });
    }
    if (method === "DELETE" && url.pathname === "/v8/management/oauth/session") {
      return json({ status: "ok", cancelled: sessions.delete(url.searchParams.get("state") ?? "") });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials") {
      return json({ observed_at: "2026-01-01T00:00:00Z", files: files.map(entry) });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials/download") {
      const file = files.find((candidate) => candidate.name === url.searchParams.get("name"));
      if (file === undefined) return json({ error: "file not found" }, 404);
      return json({ type: "claude", email: file.email, prefix: file.prefix });
    }
    if (method === "DELETE" && url.pathname === "/v8/management/credentials") {
      const name = url.searchParams.get("name") ?? "";
      const index = files.findIndex((file) => file.name === name);
      if (index === -1) return json({ error: "auth file not found" }, 404);
      files.splice(index, 1);
      deleted.push(name);
      return json({ status: "ok" });
    }
    if (method === "PATCH" && url.pathname === "/v8/management/credentials/fields") {
      if (tracker.failPatch) return json({ error: "boom" }, 500);
      const body: { name?: unknown; prefix?: unknown } = JSON.parse(typeof init?.body === "string" ? init.body : "");
      const file = files.find((candidate) => candidate.name === body.name);
      if (file === undefined) return json({ error: "auth file not found" }, 404);
      file.prefix = String(body.prefix);
      patched.push({ name: file.name, prefix: file.prefix });
      return json({ status: "ok" });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials/models") {
      return json({ models: [{ id: "claude-sonnet-4-5" }] });
    }
    return json({ error: "not found" }, 404);
  };
  return { fetch, files, sessions, patched, deleted, tracker };
}

function setup(): { fake: FakeBackend; slot: CliProxyLoginSlot; now: () => number; advance: (ms: number) => void } {
  let nowMs = NOW;
  const fake = backend();
  const slot = createMemoryLoginSlot(() => nowMs);
  return { fake, slot, now: () => nowMs, advance: (ms: number): void => { nowMs += ms; } };
}

function connectorFor(fake: FakeBackend, slot: CliProxyLoginSlot, now: () => number) {
  return createCliProxyAccountConnector({ baseUrl: BASE_URL, managementKey: MANAGEMENT_KEY, clientApiKey: CLIENT_KEY, fetch: fake.fetch, now, loginSlot: slot });
}

function redirectFor(state: string, suffix = "code=auth-code-1"): string {
  return `http://localhost:54545/callback?${suffix}&state=${state}`;
}

function completeOutOfBand(fake: FakeBackend): void {
  const session = fake.sessions.get(fake.tracker.lastState);
  if (session === undefined) throw new Error("Expected an OAuth session");
  session.done = true;
}

async function expectProxyError(promise: Promise<unknown>, code: ProxyAccountErrorCode): Promise<ProxyAccountError> {
  const error = await promise.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(ProxyAccountError);
  if (!(error instanceof ProxyAccountError)) throw new Error("Expected ProxyAccountError");
  expect(error.code).toBe(code);
  return error;
}

test("Given an in-flight login, when a second tenant starts, then it gets login_busy and the first login still completes", async () => {
  const { fake, slot, now } = setup();
  const first = connectorFor(fake, slot, now);
  const started = await first.start({ tenantId: "tenant-a", providerId: "anthropic" });
  await expectProxyError(connectorFor(fake, slot, now).start({ tenantId: "tenant-b", providerId: "anthropic" }), "login_busy");
  const target = { tenantId: "tenant-a", providerId: "anthropic", session: started.session };
  await first.submitCallback(target, redirectFor(fake.tracker.lastState));
  expect((await first.poll(target)).kind).toBe("connected");
  const retry = await connectorFor(fake, slot, now).start({ tenantId: "tenant-b", providerId: "anthropic" });
  expect(retry.authorizationUrl).toContain("https://");
});

test("Given a login slot, when the flow is cancelled, then the next tenant can start", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  await api.cancel({ tenantId: "tenant-a", providerId: "anthropic", session: started.session });
  const retry = await api.start({ tenantId: "tenant-b", providerId: "anthropic" });
  expect(retry.authorizationUrl).toContain("https://");
});

test("Given an expired session, when polling, then it reports flow_expired and frees the slot", async () => {
  const { fake, slot, now, advance } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  advance(SESSION_TTL_MS + 1);
  await expectProxyError(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: started.session }), "flow_expired");
  const retry = await api.start({ tenantId: "tenant-b", providerId: "anthropic" });
  expect(retry.authorizationUrl).toContain("https://");
});

test("Given a fresh file carrying another tenant prefix, when polling, then it is refused without patching", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  completeOutOfBand(fake);
  fake.files.push({ name: "claude-foreign.json", email: "other@example.com", prefix: "tforeignprefix0000", createdAt: new Date(NOW).toISOString() });
  await expectProxyError(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: started.session }), "account_in_use");
  expect(fake.files.length).toBe(1);
  expect(fake.patched).toEqual([]);
});

test("Given a fresh file older than the session start, when polling, then it is refused", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  completeOutOfBand(fake);
  fake.files.push({ name: "claude-stale.json", email: "stale@example.com", prefix: "", createdAt: new Date(NOW - 10 * 60 * 1000).toISOString() });
  await expectProxyError(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: started.session }), "account_in_use");
  expect(fake.files.length).toBe(1);
});

test("Given a prefix patch failure, when polling, then the file is left in place", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const target = { tenantId: "tenant-a", providerId: "anthropic", session: started.session };
  await api.submitCallback(target, redirectFor(fake.tracker.lastState));
  fake.tracker.failPatch = true;
  await expectProxyError(api.poll(target), "upstream_unavailable");
  expect(fake.files.length).toBe(1);
  expect(fake.deleted).toEqual([]);
});

test("Given a session blob, when the call target differs, then callback, poll, and cancel reject it", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const foreign = { tenantId: "tenant-b", providerId: "anthropic", session: started.session };
  await expectProxyError(api.submitCallback(foreign, redirectFor(fake.tracker.lastState)), "callback_invalid");
  await expectProxyError(api.poll(foreign), "callback_invalid");
  await expectProxyError(api.cancel(foreign), "callback_invalid");
});

test("Given an upstream denial, when polling, then the message stays fixed and the detail moves to cause", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const target = { tenantId: "tenant-a", providerId: "anthropic", session: started.session };
  await api.submitCallback(target, redirectFor(fake.tracker.lastState, "error=access_denied_SK-SECRET-XYZ-999"));
  const error = await expectProxyError(api.poll(target), "callback_invalid");
  expect(error.message).not.toContain("SK-SECRET-XYZ-999");
  expect(String(error.cause)).toContain("SK-SECRET-XYZ-999");
});

test("Given a credential whose stored prefix differs, when disconnecting, then it is kept", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const target = { tenantId: "tenant-a", providerId: "anthropic", session: started.session };
  await api.submitCallback(target, redirectFor(fake.tracker.lastState));
  const progress = await api.poll(target);
  if (progress.kind !== "connected") throw new Error("Expected connected progress");
  const stored = fake.files[0];
  if (stored === undefined) throw new Error("Expected a credential file");
  stored.prefix = "tsomeotherprefix1";
  await expectProxyError(api.disconnect({ tenantId: "tenant-a", providerId: "anthropic" }, progress.binding), "account_in_use");
  expect(fake.files.length).toBe(1);
  stored.prefix = defaultCliProxyRoutePrefix("tenant-a");
  await api.disconnect({ tenantId: "tenant-a", providerId: "anthropic" }, progress.binding);
  expect(fake.files.length).toBe(0);
});

test("Given a missing credential, when disconnecting with a matching prefix, then it succeeds silently", async () => {
  const { fake, slot, now } = setup();
  const api = connectorFor(fake, slot, now);
  await api.disconnect({ tenantId: "tenant-a", providerId: "anthropic" }, { credentialName: "claude-gone.json", routePrefix: defaultCliProxyRoutePrefix("tenant-a") });
  expect(fake.deleted).toEqual([]);
});

test("Given a memory login slot, when owners and TTLs interact, then only the holder or expiry wins", async () => {
  let nowMs = NOW;
  const slot = createMemoryLoginSlot(() => nowMs);
  expect(await slot.acquire("k", "o1", 1000)).toBeTrue();
  expect(await slot.acquire("k", "o2", 1000)).toBeFalse();
  await slot.release("k", "o2");
  expect(await slot.acquire("k", "o2", 1000)).toBeFalse();
  await slot.release("k", "o1");
  expect(await slot.acquire("k", "o2", 1000)).toBeTrue();
  nowMs += 1001;
  expect(await slot.acquire("k", "o3", 1000)).toBeTrue();
});
