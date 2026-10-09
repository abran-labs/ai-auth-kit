import { expect, test } from "bun:test";
import { renderCliProxyServerConfig } from "./cliproxyapi-config.js";

test("Given hosted inputs, when rendering, then the v8 config pins localhost, keys, auth dir, and prefixes", () => {
  const rendered = renderCliProxyServerConfig({ port: 8317, managementKey: "mgmt", clientApiKeys: ["client-1"], authDir: "/var/lib/cliproxy/auth" });
  expect(rendered).toBe([
    "# Managed by ai-auth-kit: hosted multi-account CLIProxyAPI config.",
    "# Keep this file on the host; never expose the proxy port to tenants.",
    "config-version: 8",
    "server:",
    '  host: "127.0.0.1"',
    "  port: 8317",
    "management:",
    "  allow-remote: false",
    '  secret-key: "mgmt"',
    "access:",
    "  api-keys:",
    '    - "client-1"',
    "oauth:",
    '  auth-dir: "/var/lib/cliproxy/auth"',
    "routing:",
    "  force-model-prefix: true",
    '  strategy: "fill-first"',
    "",
  ].join("\n"));
});

test("Given secrets with YAML metacharacters, when rendering, then values stay double-quoted on one line", () => {
  const rendered = renderCliProxyServerConfig({ port: 8317, managementKey: 'a"b\\c', clientApiKeys: ["k: 1 # x"], authDir: "/auth", host: "localhost", allowRemote: true });
  expect(rendered).toContain('secret-key: "a\\"b\\\\c"');
  expect(rendered).toContain('- "k: 1 # x"');
  expect(rendered).toContain('host: "localhost"');
  expect(rendered).toContain("allow-remote: true");
  expect(rendered.split("\n").every((line) => !/[\r\n]/.test(line.slice(0, -1)) || line === "")).toBeTrue();
});

test("Given invalid inputs, when rendering, then the renderer fails closed", () => {
  expect(() => renderCliProxyServerConfig({ port: 0, managementKey: "m", clientApiKeys: ["c"], authDir: "/a" })).toThrow();
  expect(() => renderCliProxyServerConfig({ port: 8317, managementKey: "", clientApiKeys: ["c"], authDir: "/a" })).toThrow();
  expect(() => renderCliProxyServerConfig({ port: 8317, managementKey: "m", clientApiKeys: [], authDir: "/a" })).toThrow();
});
