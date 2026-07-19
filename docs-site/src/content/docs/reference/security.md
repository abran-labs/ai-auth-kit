---
title: Security model
description: Trust boundaries for auth policy, credentials, remote metadata, and optional adapter downloads.
---

## Boundary summary

*Scroll tables sideways to read every column on narrow screens.*

| Boundary | Control | Limit |
| --- | --- | --- |
| Provider metadata | Parsed metadata-only schema | Models.dev is not trusted to define auth behavior. |
| Credential files | Owned regular files, `0600`, atomic no-follow writes | Same-user hostile processes remain outside the boundary. |
| Managed directories | `0700`, ownership and writable-mode checks | Protects normal user-local state, not cross-process isolation. |
| CLIProxyAPI downloads | Release/checksum/archive validation and held file descriptor | Checksums do not prove publisher identity. |

## Secrets

API-key material lives in `secrets.json` and is referenced from `config.json`. Environment auth
stores only the variable name and reads the current process environment at runtime. Runtime auth
returns provider-scoped environment values; the kit does not transmit them to model APIs.

## Remote catalog

Remote catalog content cannot add executable paths, commands, flags, request headers, request
bodies, credentials, or auth methods. Local source policy remains authoritative.
