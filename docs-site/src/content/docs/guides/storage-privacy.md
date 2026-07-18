---
title: Storage and privacy
description: Know exactly where AI Auth Kit stores configuration, secrets, and catalog metadata.
---

## Project storage

`createProjectAuthKit("my-tool")` and CLI `--project my-tool` use:

```text
./.ai-auth-kit/my-tool/config.json
./.ai-auth-kit/my-tool/secrets.json
```

`config.json` stores credential metadata and selected-model state. `secrets.json` stores API keys
or tokens by secret reference. Environment credentials store only the environment variable name.

## Global storage

Global storage is opt-in through `globalStorage("my-tool")`:

```text
$XDG_CONFIG_HOME/my-tool/
~/.config/my-tool/  # fallback when XDG_CONFIG_HOME is unset
```

Project names and app names are sanitized before becoming path components.

## Filesystem controls

- Managed directories use mode `0700`.
- JSON files use mode `0600`.
- Existing files must be owned, regular, and not group/world writable.
- Writes are atomic and do not follow symlinks.
- Removing a credential reconciles unreferenced secret material.

:::note[Threat boundary]
These controls protect normal local state from unsafe files and paths. They are not an isolation
boundary against another actively hostile process running as the same user.
:::

## Catalog cache

Models.dev metadata is separate from credentials:

```text
$XDG_CACHE_HOME/ai-auth-kit/models-dev-v1.json
~/.cache/ai-auth-kit/models-dev-v1.json
```

The cache includes source URL, ETag when supplied, fetch time, source SHA-256, and provenance.
