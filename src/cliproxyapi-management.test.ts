import { expect, test } from "bun:test";
import {
  CliProxyManagementError,
  createCliProxyManagementClient,
  type CliProxyManagementErrorCode,
  type CliProxyManagementFetch,
} from "./cliproxyapi-management.js";

const BASE_URL = "http://127.0.0.1:8317";
const KEY = "test-management-key";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetch: CliProxyManagementFetch, baseUrl = BASE_URL) {
  return createCliProxyManagementClient({ baseUrl, managementKey: KEY, fetch });
}

async function expectCode(promise: Promise<unknown>, code: CliProxyManagementErrorCode): Promise<CliProxyManagementError> {
  const error = await promise.then(
    () => undefined,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(CliProxyManagementError);
  if (!(error instanceof CliProxyManagementError)) throw new Error("Expected CliProxyManagementError");
  const typed = error;
  expect(typed.code).toBe(code);
  return typed;
}

test("Given valid credential payloads, when listing, then files map to typed entries", async () => {
  const seen: string[] = [];
  const api = client(async (input, init) => {
    seen.push(`${init?.method ?? "GET"} ${input}`);
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(init?.redirect).toBe("error");
    return json({ observed_at: "2026-01-01T00:00:00Z", files: [{ id: "a", auth_index: "i", name: "claude-x.json", type: "claude", provider: "claude", label: "l", status: "active", disabled: false, email: "u@example.com" }] });
  });
  const files = await api.listCredentials();
  expect(seen).toEqual(["GET http://127.0.0.1:8317/v8/management/credentials"]);
  expect(files).toEqual([{ id: "a", authIndex: "i", name: "claude-x.json", type: "claude", provider: "claude", label: "l", status: "active", disabled: false, email: "u@example.com" }]);
});

test("Given malformed management payloads, when parsed, then the client fails closed", async () => {
  const api = client(async () => json({ observed_at: "now", files: [{ name: "x.json" }] }));
  const error = await expectCode(api.listCredentials(), "invalid_response");
  expect(error.message).not.toContain(KEY);
});

test("Given non-JSON management output, when parsed, then the client fails closed", async () => {
  const api = client(async () => new Response("not json", { status: 200 }));
  await expectCode(api.listCredentials(), "invalid_response");
});

test("Given an oversized response, when read, then the client refuses before buffering", async () => {
  const api = client(async () => new Response("{}", { status: 200, headers: { "content-length": "99999999" } }));
  await expectCode(api.listCredentials(), "invalid_response");
});

test("Given management status codes, when requests fail, then codes map without leaking the key", async () => {
  for (const [status, code] of [[400, "bad_request"], [401, "unauthorized"], [403, "unauthorized"], [404, "not_found"], [409, "conflict"], [500, "upstream_unavailable"]] as const) {
    const api = client(async () => new Response("{}", { status }));
    const error = await expectCode(api.deleteCredential("claude-x.json"), code);
    expect(error.message).not.toContain(KEY);
    expect(error.status).toBe(status);
  }
});

test("Given a network failure, when requesting, then the error stays typed and key-free", async () => {
  const api = client(async () => { throw new Error(`boom ${KEY}`); });
  const error = await expectCode(api.listCredentials(), "upstream_unavailable");
  expect(error.message).not.toContain(KEY);
});

test("Given unsafe options, when the client is created, then it rejects invalid base URLs and keys", async () => {
  expect(() => createCliProxyManagementClient({ baseUrl: "ftp://x/", managementKey: KEY })).toThrow(CliProxyManagementError);
  expect(() => createCliProxyManagementClient({ baseUrl: "http://user@127.0.0.1:8317", managementKey: KEY })).toThrow(CliProxyManagementError);
  expect(() => createCliProxyManagementClient({ baseUrl: BASE_URL, managementKey: "" })).toThrow(CliProxyManagementError);
  expect(() => createCliProxyManagementClient({ baseUrl: BASE_URL, managementKey: KEY, timeoutMs: 0 })).toThrow(CliProxyManagementError);
});
