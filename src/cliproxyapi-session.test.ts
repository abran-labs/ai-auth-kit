import { expect, test } from "bun:test";
import { createCliProxyAccountConnector, createMemoryLoginSlot } from "./cliproxyapi-connector.js";
import type { CliProxyManagementFetch } from "./cliproxyapi-management.js";
import { ProxyAccountError } from "./hosted-types.js";

const MANAGEMENT_KEY = "test-management-key";

const fetchStub: CliProxyManagementFetch = async (input) => {
  const url = new URL(input);
  if (url.pathname === "/v8/management/oauth/auth-url") {
    return new Response(JSON.stringify({ status: "ok", url: "https://claude.ai/oauth?state=st-1", state: "st-1" }), { headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/v8/management/credentials") {
    return new Response(JSON.stringify({ observed_at: "2026-01-01T00:00:00Z", files: [] }), { headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ status: "wait" }), { headers: { "Content-Type": "application/json" } });
};

function connector() {
  return createCliProxyAccountConnector({ baseUrl: "http://127.0.0.1:8317", managementKey: MANAGEMENT_KEY, clientApiKey: "test-client-key", fetch: fetchStub, now: () => 1_700_000_000_000, loginSlot: createMemoryLoginSlot(() => 1_700_000_000_000) });
}

async function expectFlowExpired(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(() => undefined, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(ProxyAccountError);
  if (!(error instanceof ProxyAccountError)) throw new Error("Expected ProxyAccountError");
  expect(error.code).toBe("flow_expired");
}

test("Given a tampered session blob, when polling, then it reports flow_expired", async () => {
  const api = connector();
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const [version, payload, signature] = started.session.split(".");
  const flipped = `${signature?.startsWith("A") ? "B" : "A"}${signature?.slice(1) ?? ""}`;
  const tampered = `${version}.${payload}.${flipped}`;
  await expectFlowExpired(api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: tampered }));
});

test("Given a non-canonical signature encoding, when polling, then it reports flow_expired", async () => {
  // Given: the same signature bytes re-encoded with different trailing padding bits
  const api = connector();
  const started = await api.start({ tenantId: "tenant-a", providerId: "anthropic" });
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const [version, payload, signature = ""] = started.session.split(".");
  const last = alphabet.indexOf(signature.slice(-1));
  const alias = `${signature.slice(0, -1)}${alphabet[last ^ 1] ?? ""}`;

  // When: the aliased session is polled
  const polled = api.poll({ tenantId: "tenant-a", providerId: "anthropic", session: `${version}.${payload}.${alias}` });

  // Then: only the canonical signature string is accepted
  await expectFlowExpired(polled);
});
