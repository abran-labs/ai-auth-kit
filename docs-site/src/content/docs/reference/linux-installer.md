---
title: Linux installer
description: Release-pending platform scope, lifecycle commands, and trust requirements.
---

:::caution[Planned, not currently released]
The installer source exists, but no verified public release or successful public attestation
verification exists. This page is a design and command reference, not current installation advice.
Use the exact Git dependency from the quickstart.
:::

## Planned platform scope

| Architecture | glibc | musl |
| --- | --- | --- |
| Linux x64 | Planned | Planned |
| Linux arm64 | Planned | Planned |

The bootstrap manager is a static musl executable. Bun musl CLI artifacts need
`libstdc++.so.6` and `libgcc_s.so.1`; Alpine provides both with:

```sh
apk add --no-cache libstdc++
```

## Lifecycle interface

```text
ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE [--version vX.Y.Z] [--dry-run] [--force] [--yes]
ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE --update [--dry-run] [--force] [--yes]
ai-auth-kit-installer-manager --release-dir DIRECTORY --rollback [--dry-run] [--force] [--yes]
ai-auth-kit-installer-manager --release-dir DIRECTORY --uninstall [--dry-run] [--force] [--yes]
```

Install and update read a complete local release directory and require exactly one valid signed
bundle. Rollback and uninstall use retained managed state; the parser still requires
`--release-dir`, but those modes do not read it and need no receipt.

## Release requirement

A future public install URL must be pinned to a reviewed 40-character source commit. Release
artifacts must pass exact manifest/checksum validation and a signed bundle rooted in verified
GitHub provenance. `SHA256SUMS` alone is not a fallback.
