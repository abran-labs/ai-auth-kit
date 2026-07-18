---
title: CLI reference
description: Complete ai-auth-kit command, option, default, and interaction contract.
---

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Create or validate project storage. |
| `providers` | List available providers. |
| `login [provider]` | Choose and save supported authentication. |
| `models [provider]` | List models, prompting for a provider when omitted. |
| `use [provider] [model]` | Save a selected model, prompting for omitted IDs. |
| `current` | Print the selected provider and model. |
| `doctor` | Print project counts, selected model, and storage paths. |
| `catalog status` | Print catalog source and freshness state. |
| `catalog refresh` | Request a metadata refresh. |
| `path` | Print the project storage path. |

## Options

| Option | Meaning |
| --- | --- |
| `--project name`, `-p name` | Select named project storage. |
| `--version`, `-V` | Print version. |
| `--help`, `-h` | Print help. |

The project defaults to `default`; storage defaults to `./.ai-auth-kit/<project-name>`.

```text
ai-auth-kit login [provider] [--project name]
ai-auth-kit use [provider] [model] [--project name]
```

No `--global`, `--token`, provider-specific login flag, or verbose flag is part of the CLI
contract.
