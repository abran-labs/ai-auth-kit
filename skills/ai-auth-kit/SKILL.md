---
name: ai-auth-kit
description: >
  Integrate @abran-labs/ai-auth-kit into TypeScript host applications: provider and model
  selection, API-key/environment/account auth, host-owned prompts, storage, and runtime auth.
  Use when implementing or troubleshooting AI Auth Kit. Skip package publishing and generic
  standalone command creation.
license: MIT
compatibility: Claude Code, OpenCode, Codex
---

# AI Auth Kit

Library version: exactly 1.0.0. Skill version: exactly 1.0.0.

## Mandatory first action

Before guidance, code edits, or commands, run once per agent session from host project root:

```sh
node "${HOME}/.agents/skills/ai-auth-kit/scripts/check-library-version.mjs" --project-dir "$PWD"
```

This local checker must report `detected=1.0.0` and `expected=1.0.0`. Do not continue after a
missing package, mismatch, or checker failure. Report its `path`, `detected`, `expected`, and
`upgrade` fields exactly. Never update silently. User runs the remediation:

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

No portable skill-load hook exists across Claude Code, OpenCode, and Codex. This explicit first
action is required every new agent session.

Bundled skill references are primary knowledge for agent implementation.
Docs are fallback only when these local references do not answer a question. Normal use must not depend on external
documentation; never replace the bundled API/security guidance with a generic docs search.

## Workflow

1. Confirm host owns command names, routing, output, cancellation UX, and provider-client calls.
2. Read [references/api.md](references/api.md) before choosing public exports.
3. Read [references/auth-and-models.md](references/auth-and-models.md) for provider/auth/catalog
   behavior.
4. Read [references/host-patterns.md](references/host-patterns.md) before implementing prompts or
   command handlers.
5. Read [references/security.md](references/security.md) before storing credentials, enabling
   account OAuth, or provisioning CLIProxyAPI.
6. Import package root only. Implement minimum host-owned flow. Verify cancellation and failure
   paths save no unintended credential.

## Non-negotiable boundaries

- AI Auth Kit is a library, not a generic command-line product. Never invent a global
  `ai-auth-kit` executable or generic command syntax.
- Install exact package only: `bun add @abran-labs/ai-auth-kit@1.0.0`. Never recommend `latest`,
  ranges, Git dependencies, copied source, or internal imports.
- Package supplies runtime behavior. This skill supplies implementation knowledge to coding
  agents. Installing either does not install the other.
- Remote Models.dev data is metadata only. Never derive commands, executable paths, headers,
  bodies, credentials, or auth policy from it.
- Host sends requests. `runtimeAuth()` resolves auth material but does not call model APIs.

## Completion checklist

- Version checker passed in current session.
- Root import only.
- Host owns command/UI surface.
- Auth method exists in provider local policy.
- Cancellation and declined warnings produce no saved credential.
- Secrets never logged or placed in `config.json`.
- Selected model and `runtimeAuth(providerId)` handled explicitly.
- Long-running catalog refresh disposed during shutdown.
