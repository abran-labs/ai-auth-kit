---
title: Agent skill
description: Prepare version-matched AI Auth Kit implementation knowledge for Claude Code, OpenCode, and Codex.
---

AI Auth Kit has two deliberately separate surfaces:

| Surface | Purpose | Availability |
| --- | --- | --- |
| `@abran-labs/ai-auth-kit@1.0.0` | Runtime library used by your application. | Pending npm publication. |
| Agent skill `1.0.0` | Local API, auth-flow, host-pattern, and security knowledge used by a coding agent. | Pending release asset upload. |

Coding agents can inspect runtime source, but reconstructing every provider policy, OAuth ordering,
storage boundary, and failure rule slows implementation and risks omissions. The skill supplies
that version-matched context immediately. It adds no runtime code and creates no generic command.
Bundled skill references are primary knowledge for agent implementation.
Docs are fallback only when those local references do not answer a question. Normal implementation does not depend
on external documentation.

*Scroll command blocks sideways when their full contents extend past the reading column.*

## Install the runtime package

From the host project:

Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.0.0 is published.

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

## Install the skill

The separately versioned skill will be delivered by a reviewed curl installer. It will verify the
immutable manifest, archive SHA-256, exact payload inventory, and every payload file before
installing.

Pending: use this exact command after the agent-skill-v1.0.0 release asset is uploaded.

```sh
curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh
```

The installer will create one canonical payload at `~/.agents/skills/ai-auth-kit` and only the
Claude compatibility symlink at `~/.claude/skills/ai-auth-kit`; it will not create an OpenCode
duplicate.

No `~/.config/opencode/skills/ai-auth-kit` copy is created. OpenCode already discovers the
canonical Agent Skills path. One payload avoids duplicate-name collisions and version drift.

Quit and restart Claude Code, OpenCode, or Codex after installation because skill discovery may be
fixed at session start.

## Mandatory first use in every agent session

No portable cross-platform skill-load hook exists. The first instruction in `SKILL.md` makes the
agent run the bundled checker from your host project:

```sh
node "${HOME}/.agents/skills/ai-auth-kit/scripts/check-library-version.mjs" --project-dir "$PWD"
```

The checker resolves the installed package and requires exactly `1.0.0`. After npm publication, it
will report package path, detected version, expected version, and this exact remediation when
missing or mismatched.

Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.0.0 is published.

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

It never updates dependencies silently. The agent must stop until the user resolves a mismatch.

## Replace or remove

Existing non-symlink targets are preserved. To replace a prior installation, inspect and remove
the canonical directory yourself, then rerun the exact versioned command. Removing the canonical
directory and Claude symlink uninstalls the skill; it does not remove the project package or stored
credentials.
