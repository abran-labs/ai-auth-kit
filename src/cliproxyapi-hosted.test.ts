import { expect, test } from "bun:test";
import { createCliProxyAccountConnector, createMemoryLoginSlot, defaultCliProxyRoutePrefix } from "./cliproxyapi-connector.js";
import type { CliProxyManagementFetch } from "./cliproxyapi-management.js";
import { ProxyAccountError, type ProxyAccountBinding, type ProxyAccountErrorCode } from "./hosted-types.js";

const BASE_URL = "http://127.0.0.1:8317";
const MANAGEMENT_KEY = "test-management-key";
const CLIENT_KEY = "test-client-key";
const NOW = 1_700_000_000_000;

interface FakeFile { name: string; email: string; prefix?: string }
interface FakeSession { done: boolean; failed?: string }

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function entry(file: FakeFile): unknown {
  return { id: file.name, auth_index: "idx", name: file.name, type: "claude", provider: "claude", label: file.name, status: "active", disabled: false, email: file.email, created_at: new Date(NOW).toISOString() };
}

function createFake(initial: readonly FakeFile[] = []): {
  readonly fetch: CliProxyManagementFetch;
  readonly files: FakeFile[];
  readonly sessions: Map<string, FakeSession>;
  readonly patched: { readonly name: string; readonly prefix: string }[];
  readonly seen: { lastState: string };
} {
  const files: FakeFile[] = [...initial];
  const sessions = new Map<string, FakeSession>();
  const patched: { name: string; prefix: string }[] = [];
  const seen: { lastState: string } = { lastState: "" };
  let sequence = 0;
  const fetch: CliProxyManagementFetch = async (input, init) => {
    const url = new URL(input);
    if (new Headers(init?.headers).get("Authorization") !== `Bearer ${MANAGEMENT_KEY}`) {
      return json({ status: "error", error: "forbidden" }, 401);
    }
    const method = init?.method ?? "GET";
    if (method === "GET" && url.pathname === "/v8/management/oauth/auth-url") {
      if (url.searchParams.get("provider") !== "claude") return json({ error: "provider_not_found" }, 404);
      sequence += 1;
      const state = `st-${sequence}`;
      seen.lastState = state;
      sessions.set(state, { done: false });
      return json({ status: "ok", url: `https://claude.ai/oauth?state=${state}`, state });
    }
    if (method === "POST" && url.pathname === "/v8/management/oauth/callback") {
      const raw = typeof init?.body === "string" ? init.body : "";
      const body: { provider?: unknown; redirect_url?: unknown } = JSON.parse(raw);
      const redirect = new URL(String(body.redirect_url ?? ""));
      const state = redirect.searchParams.get("state") ?? "";
      const session = sessions.get(state);
      if (session === undefined) return json({ status: "error", error: "unknown or expired state" }, 404);
      if (session.done) return json({ status: "error", error: "oauth flow is already completed" }, 409);
      if (body.provider !== "claude") return json({ status: "error", error: "provider does not match state" }, 400);
      const failure = redirect.searchParams.get("error");
      if (failure !== null) {
        session.failed = failure;
        return json({ status: "ok" });
      }
      session.done = true;
      files.push({ name: `claude-abc12345-user${sequence}@example.com.json`, email: `user${sequence}@example.com` });
      return json({ status: "ok" });
    }
    if (method === "GET" && url.pathname === "/v8/management/oauth/status") {
      const session = sessions.get(url.searchParams.get("state") ?? "");
      if (session === undefined) return json({ status: "error", error: "unknown or expired state" });
      if (session.failed !== undefined) return json({ status: "error", error: session.failed });
      return json(session.done ? { status: "ok" } : { status: "wait" });
    }
    if (method === "DELETE" && url.pathname === "/v8/management/oauth/session") {
      const state = url.searchParams.get("state") ?? "";
      return json({ status: "ok", cancelled: sessions.delete(state) });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials") {
      return json({ observed_at: "2026-01-01T00:00:00Z", files: files.map(entry) });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials/download") {
      const file = files.find((candidate) => candidate.name === url.searchParams.get("name"));
      if (file === undefined) return json({ error: "auth file not found" }, 404);
      return json({ type: "claude", email: file.email, prefix: file.prefix ?? "" });
    }
    if (method === "DELETE" && url.pathname === "/v8/management/credentials") {
      const name = url.searchParams.get("name") ?? "";
      const index = files.findIndex((file) => file.name === name);
      if (index === -1) return json({ error: "auth file not found" }, 404);
      files.splice(index, 1);
      return json({ status: "ok" });
    }
    if (method === "PATCH" && url.pathname === "/v8/management/credentials/fields") {
      const raw = typeof init?.body === "string" ? init.body : "";
      const body: { name?: unknown; prefix?: unknown } = JSON.parse(raw);
      const file = files.find((candidate) => candidate.name === body.name);
      if (file === undefined) return json({ error: "auth file not found" }, 404);
      file.prefix = String(body.prefix);
      patched.push({ name: file.name, prefix: file.prefix });
      return json({ status: "ok" });
    }
    if (method === "GET" && url.pathname === "/v8/management/credentials/models") {
      const file = files.find((candidate) => candidate.name === url.searchParams.get("name"));
      if (file === undefined) return json({ error: "auth file not found" }, 404);
      return json({ models: [{ id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" }, { id: "claude-opus-4-1" }] });
    }
    return json({ error: "not found" }, 404);
  };
  return { fetch, files, sessions, patched, seen };
}

function connector(fake: ReturnType<typeof createFake>) {
  return createCliProxyAccountConnector({ baseUrl: BASE_URL, managementKey: MANAGEMENT_KEY, clientApiKey: CLIENT_KEY, fetch: fake.fetch, now: () => NOW, loginSlot: createMemoryLoginSlot(() => NOW) });
}

function sessionState(fake: ReturnType<typeof createFake>): string {
  return fake.seen.lastState;
}

function redirectFor(state: string, suffix = "code=auth-code-1"): string {
  return `http://localhost:54545/callback?${suffix}&state=${state}`;
}

async function connectedBinding(tenantId = "tenant-a"): Promise<{ fake: ReturnType<typeof createFake>; binding: ProxyAccountBinding }> {
  const fake = createFake();
  const api = connector(fake);
  const started = await api.start({ tenantId, providerId: "anthropic" });
  const state = sessionState(fake);
  expect(started.expiresAt).toBe(NOW + 5 * 60 * 1000);
  expect(started.callbackPrefix).toBe("http://localhost:54545/callback");
  expect(await api.poll({ tenantId, providerId: "anthropic", session: started.session })).toEqual({ kind: "pending" });
  await api.submitCallback({ tenantId, providerId: "anthropic", session: started.session }, redirectFor(state));
  const progress = await api.poll({ tenantId, providerId: "anthropic", session: started.session });
  if (progress.kind !== "connected") throw new Error("Expected connected progress");
  return { fake, binding: progress.binding };
}

async function expectProxyError(promise: Promise<unknown>, code: ProxyAccountErrorCode): Promise<ProxyAccountError> {
  const error = await promise.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(ProxyAccountError);
  if (!(error instanceof ProxyAccountError)) throw new Error("Expected ProxyAccountError");
  const typed = error;
  expect(typed.code).toBe(code);
  return typed;
}

test("Given a fresh tenant, when connecting, then the new file is prefix-pinned and routing uses it", async () => {
  const { fake, binding } = await connectedBinding("tenant-a");
  expect(binding.routePrefix).toBe(defaultCliProxyRoutePrefix("tenant-a"));
  expect(binding.email).toBe("user1@example.com");
  expect(fake.patched).toEqual([{ name: binding.credentialName, prefix: binding.routePrefix }]);
  const api = connector(fake);
  expect(api.route(binding, "claude-sonnet-4-5")).toEqual({
    baseUrl: `${BASE_URL}/v1`,
    headers: { Authorization: `Bearer ${CLIENT_KEY}` },
    model: `${binding.routePrefix}/claude-sonnet-4-5`,
    wire: "openai-chat",
  });
  expect(api.route(binding, "x").headers["Authorization"]).not.toContain(MANAGEMENT_KEY);
  const models = await api.models(binding);
  expect(models).toEqual([{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" }, { id: "claude-opus-4-1", name: "claude-opus-4-1" }]);
});

test("Given the same Claude account completes twice, when polling, then the second tenant gets account_in_use", async () => {
  const fake = createFake();
  const api = connector(fake);
  const first = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  await api.submitCallback({ tenantId: "tenant-a", providerId: "anthropic", session: first.session }, redirectFor(sessionState(fake)));
  expect((await api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: first.session })).kind).toBe("connected");
  // Second tenant snapshots after the first account exists, then completes the
  // SAME Claude account: the proxy merges into the existing file, so no new
  // file appears and the tenants must not share it.
  const second = await api.start({ tenantId: "tenant-b", providerId: "anthropic" });
  await api.submitCallback({ tenantId: "tenant-b", providerId: "anthropic", session: second.session }, redirectFor(sessionState(fake), "code=other-code"));
  fake.files.pop();
  await expectProxyError(api.poll({ tenantId: "tenant-b", providerId: "anthropic", session: second.session }), "account_in_use");
});

test("Given callback URLs with wrong prefix, state, or code, when submitting, then callback_invalid without network use", async () => {
  const fake = createFake();
  const api = connector(fake);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const target = { tenantId: "tenant-a", providerId: "anthropic", session: started.session };
  await expectProxyError(api.submitCallback(target, "http://evil.example/callback?code=x&state=y"), "callback_invalid");
  await expectProxyError(api.submitCallback(target, redirectFor("wrong-state"), ), "callback_invalid");
  await expectProxyError(api.submitCallback(target, "http://localhost:54545/callback?state=x"), "callback_invalid");
  await api.cancel(target);
});

test("Given oauth status failures, when polling, then unknown maps to flow_expired and denial to callback_invalid", async () => {
  const fake = createFake();
  const api = connector(fake);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const state = sessionState(fake);
  fake.sessions.delete(state);
  await expectProxyError(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: started.session }), "flow_expired");
  const retry = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const retryState = sessionState(fake);
  await api.submitCallback({ tenantId: "tenant-a", providerId: "anthropic", session: retry.session }, redirectFor(retryState, "error=access_denied"));
  const error = await expectProxyError(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: retry.session }), "callback_invalid");
  expect(error.message).not.toContain("access_denied");
  expect(String(error.cause)).toContain("access_denied");
});

test("Given a foreign binding, when disconnecting, then the file is kept and account_in_use is thrown", async () => {
  const { fake, binding } = await connectedBinding("tenant-a");
  const api = connector(fake);
  const before = fake.files.length;
  await expectProxyError(api.disconnect({ tenantId: "tenant-b", providerId: "anthropic" }, binding), "account_in_use");
  expect(fake.files.length).toBe(before);
  await api.disconnect({ tenantId: "tenant-a", providerId: "anthropic" }, binding);
  expect(fake.files.length).toBe(before - 1);
  await api.disconnect({ tenantId: "tenant-a", providerId: "anthropic" }, binding);
});

test("Given a stale session, when cancelling, then unknown states are ignored", async () => {
  const fake = createFake();
  const api = connector(fake);
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  await api.cancel({ tenantId: "tenant-a", providerId: "anthropic", session: started.session });
  await api.cancel({ tenantId: "tenant-a", providerId: "anthropic", session: started.session });
  await api.cancel({ tenantId: "tenant-a", providerId: "anthropic", session: "garbage" });
});

test("Given unsupported providers or models, when used, then the connector rejects them", async () => {
  const fake = createFake();
  const api = connector(fake);
  expect(api.providerIds).toEqual(["anthropic"]);
  expect(api.warning("anthropic")).toContain("Claude");
  await expectProxyError(api.start({ tenantId: "t", providerId: "google" }), "upstream_unavailable");
  const { binding } = await connectedBinding("tenant-a");
  expect(() => connector(fake).route(binding, "")).toThrow(ProxyAccountError);
  expect(() => connector(fake).route(binding, "a/b")).toThrow(ProxyAccountError);
});
