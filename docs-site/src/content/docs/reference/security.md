---
title: Security model
description: Trust boundaries for auth policy, credentials, remote metadata, downloads, and installers.
---

## Boundary summary

| Boundary | Control | Limit |
| --- | --- | --- |
| Provider metadata | Parsed metadata-only schema | Models.dev is not trusted to define auth behavior. |
| Credential files | Owned regular files, `0600`, atomic no-follow writes | Same-user hostile processes remain outside the boundary. |
| Managed directories | `0700`, ownership and writable-mode checks | Protects normal user-local state, not cross-process isolation. |
| CLIProxyAPI downloads | Release/checksum/archive validation and held file descriptor | Checksums do not prove publisher identity. |
| Installer releases | Exact manifest plus signed bundle and GitHub provenance gate | No verified public release is claimed yet. |

## Secrets

API-key material lives in `secrets.json` and is referenced from `config.json`. Environment auth
stores only the variable name and reads the current process environment at runtime. Runtime auth
returns provider-scoped environment values; the kit does not transmit them to model APIs.

## Remote catalog

Remote catalog content cannot add executable paths, commands, flags, request headers, request
bodies, credentials, or auth methods. Local source policy remains authoritative.

## Release provenance

The installer design requires a signed bundle that matches exact repository, workflow, tag,
source commit, manifest, assets, and attestation metadata. A future release process may sign only
after GitHub attestation verification succeeds. Local fixtures prove transaction behavior only.

:::danger[Current installer status]
No public release, signed public bundle, or successful public attestation verification is claimed.
Use exact Git source consumption until that changes.
:::
