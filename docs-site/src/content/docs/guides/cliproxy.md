---
title: Optional CLIProxyAPI account login
description: Understand when AI Auth Kit provisions CLIProxyAPI and which safety checks apply.
---

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) is an unofficial local account-routing
adapter used only for optional Anthropic and Google account login. API-key and environment-variable
users do not need it.

## Flow

1. Choose Anthropic or Google account login.
2. Read and explicitly accept the provider terms and account-risk warning.
3. Use an explicit absolute binary path, or allow verified Linux provisioning.
4. Complete the upstream browser login.
5. Save external OAuth metadata pointing at the local adapter.

The default local base URL is `http://localhost:8317`.

## Provisioning boundary

- Environment `PATH` is ignored.
- An explicit binary must pass path, ownership, mode, and file checks.
- Automatic provisioning supports Linux x64 and arm64 only.
- Download handling validates release metadata, expected asset name and URL, checksum file,
  archive digest, size, and archive shape before caching or execution.
- The executable is opened through a held file descriptor.

:::caution[Checksums are not identity]
A checksum detects changed bytes relative to an expected digest. It does not independently prove
who produced the release. Decide whether this adapter fits your provider and account risk.
:::

## Hosted multi-account mode

One CLIProxyAPI instance can serve many tenants (for example Discord guilds), each with its own
Claude account. `createCliProxyAccountConnector` drives the management API (`/v8/management`) for
the `redirect-paste`/`working` connect steps, and `renderCliProxyServerConfig` renders a hardened
v8 server config.

- One proxy, one host: the server binds to `127.0.0.1`; only the host holds the management key
  and client API keys. Any client key can address any model prefix, so never expose the proxy
  port to tenants.
- Per-tenant prefix pinning: each connected credential gets a `prefix` (default `t` + 16 hex of
  `sha256(tenantId)`), and requests use `<prefix>/<model>` on the OpenAI chat wire at `/v1`.
  (`/v1/messages` with the same prefixed model also works.)
- `routing.force-model-prefix: true` keeps unprefixed requests off tenant credentials.
- One Claude account maps to one tenant: credential filenames derive from account identity, so a
  repeat connect with the same account yields `account_in_use` instead of sharing the file.
- Same account-terms risk as local mode: subscription automation may violate provider terms and
  get the account limited.
