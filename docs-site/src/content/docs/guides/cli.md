---
title: Use the CLI
description: Configure provider authentication and model selection through the ai-auth-kit CLI.
---

The CLI and library write the same storage format. Use a stable project name so your application
and setup commands resolve the same directory.

## First use

```sh
ai-auth-kit init --project my-tool
ai-auth-kit providers --project my-tool
ai-auth-kit login --project my-tool
ai-auth-kit use --project my-tool
ai-auth-kit current --project my-tool
```

Omit the provider or model from `login` and `use` to receive an interactive picker. Supply IDs
when scripting a known choice.

## Check health and paths

```sh
ai-auth-kit path --project my-tool
ai-auth-kit doctor --project my-tool
ai-auth-kit catalog status --project my-tool
```

`path` prints the project storage location. `doctor` prints project counts, selected model, and
storage paths. Catalog status shows whether current metadata came from the bundled snapshot,
cache, or a refresh.

## Refresh metadata

```sh
ai-auth-kit catalog refresh --project my-tool
```

Refresh updates metadata only. It does not rewrite credentials or selected-model state.

:::tip[Default project]
Without `--project` or `-p`, the project name is `default` and storage begins at
`./.ai-auth-kit/default/`.
:::

See the [CLI reference](../../reference/cli/) for the complete command contract.
