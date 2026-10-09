import { z } from "zod";

export interface CliProxyServerConfigOptions {
  readonly port: number;
  readonly managementKey: string;
  readonly clientApiKeys: readonly string[];
  readonly authDir: string;
  readonly host?: string;
  readonly allowRemote?: boolean;
}

const OptionsSchema = z
  .object({
    port: z.number().int().min(1).max(65535),
    managementKey: z.string().min(1).max(4096),
    clientApiKeys: z.array(z.string().min(1).max(4096)).min(1).readonly(),
    authDir: z.string().min(1).max(4096),
    host: z.string().min(1).max(256).optional(),
    allowRemote: z.boolean().optional(),
  })
  .readonly();

function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

// Renders a hardened v8 CLIProxyAPI server config for hosted multi-account mode:
// the proxy binds to localhost, management stays local-only, client keys belong to
// the host (never tenants), and model prefixes pin each tenant to its own account.
// Key names follow config.example.yaml and internal/config/config_v8.go.
export function renderCliProxyServerConfig(options: CliProxyServerConfigOptions): string {
  const parsed = OptionsSchema.parse(options);
  const host = parsed.host ?? "127.0.0.1";
  const allowRemote = parsed.allowRemote ?? false;
  const keys = parsed.clientApiKeys.map((key) => `    - ${yamlString(key)}`).join("\n");
  return [
    "# Managed by ai-auth-kit: hosted multi-account CLIProxyAPI config.",
    "# Keep this file on the host; never expose the proxy port to tenants.",
    "config-version: 8",
    "server:",
    `  host: ${yamlString(host)}`,
    `  port: ${parsed.port}`,
    "management:",
    `  allow-remote: ${allowRemote ? "true" : "false"}`,
    `  secret-key: ${yamlString(parsed.managementKey)}`,
    "access:",
    "  api-keys:",
    keys,
    "oauth:",
    `  auth-dir: ${yamlString(parsed.authDir)}`,
    "routing:",
    "  force-model-prefix: true",
    '  strategy: "fill-first"',
    "",
  ].join("\n");
}
