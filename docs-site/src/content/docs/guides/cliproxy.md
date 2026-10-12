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
- One login at a time per proxy: the connector holds a global login slot while a Claude login
  is in flight, and `start` returns `login_busy` when another tenant's login is active. The host
  should surface that as "try again shortly". The default slot store is process-local; hosts
  running several processes must inject a shared `loginSlot` store (same shape as
  `createMemoryLoginSlot`), otherwise concurrent logins in different processes can bind or
  re-prefix each other's credential file.
- The host must be the only management client: any other writer can create credential files the
  connector cannot attribute, and a second `start` path bypasses the slot. Files whose stored
  `prefix` belongs to another tenant, or whose `created_at` predates the login, are refused
  with `account_in_use` and never patched or deleted.
- Sessions are HMAC-signed blobs (key defaults to the management key, overridable with
  `sessionSecret`); tampered or cross-tenant session reuse is rejected. `disconnect` re-reads
  the stored `prefix` before deleting, so a forged binding cannot remove another tenant's file.
  Credentials connected before this hardening carry no stored prefix, so their first
  `disconnect` is refused with `account_in_use`; reconnect the account or delete the file
  manually through the management API.
- Same account-terms risk as local mode: subscription automation may violate provider terms and
  get the account limited.
