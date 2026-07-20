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
