# Canonical 0.2.0 Contract

## Status and scope

`@abran-labs/ai-auth-kit` and the `ai-auth-kit` CLI are the canonical public
identity for version `0.2.0`. This document freezes the compatibility target;
it does not change the package manifest, which is owned by the Bun migration
work. Git consumers must import tracked source or tracked built exports without
requiring `prepare`, `postinstall`, or another lifecycle build.

## Library API

The package root exposes only the symbols enumerated by
`test/contract.test.ts`. That list includes `AuthKit`, factory functions,
storage implementations and paths, picker helpers, account OAuth helpers,
CLIProxyAPI APIs, external-auth helpers, `DEFAULT_PROVIDERS`, and the public
types from `src/types.ts`. Existing exported names remain compatible; new
capabilities require a documented additive change.

Both source and built declaration consumers are type-checked through the
explicit paths in `test/fixtures/contracts/tsconfig.json`. A future build-layout
change must update that fixture config rather than weakening the consumer
fixture.

## CLI

The executable name is `ai-auth-kit`. Its stable commands are `init`,
`providers`, `login`, `models`, `use`, `current`, `doctor`, and `path`.
Every command accepts `--project name`; `-p` remains its alias. `--help`, `-h`,
and `help` print the help fixture. The default project is `default`, stored in
`./.ai-auth-kit/default`. `--project` and `-p` require a following nonempty
value that is not another flag. Missing, empty, or flag-valued arguments exit
nonzero and write exactly `Missing value for --project` to stderr.

## Storage and serialized state

Project state lives at `./.ai-auth-kit/<sanitized-project>/config.json` and
`secrets.json`. Global state lives at `$XDG_CONFIG_HOME/ai-auth-kit/`, or
`~/.config/ai-auth-kit/` when `XDG_CONFIG_HOME` is unset. JSON files are
pretty-printed with a trailing newline and written with mode `0600`.

`config.json` contains `credentials`, optional `selectedModel` with
`providerId`, `modelId`, and `updatedAt`, plus top-level `updatedAt`.
`secrets.json` maps secret references to strings. Credentials are exactly the
`api-key`, `env`, `oauth-external`, and `none` tagged shapes. API-key references
use `provider:<provider-id>:api-key`.

## Auth, CLIProxyAPI, and remote data

Provider auth methods are local reviewed policy: API key, environment,
external OAuth, or no auth. OpenAI and GitHub Copilot use local account OAuth
flows. Anthropic and Google external OAuth use reviewed CLIProxyAPI handling.
Claude launches `--claude-login`; Google launches `--antigravity-login`.

CLIProxyAPI must never discover or execute a binary implicitly from `PATH`.
Only an explicit caller path that passes future security validation, or a
verified local cache/download, may be run. Remote model catalog data is inert:
it may describe provider/model metadata only. It cannot supply commands,
OAuth behavior, executable paths, headers, request bodies, credentials, or
transport policy.

## Historical selections and baseline differences

When a current catalog no longer contains a configured provider or model, the
persisted historical selection remains resolvable from its immutable saved
metadata. Removed/deprecated entries are hidden from new picker choices. The
state must not be silently rewritten.

Todo 1 sealed restores record two intentional pre-merge differences, without
selecting either tree wholesale: standalone currently discovers CLIProxyAPI on
`PATH` and uses Google `--login`; embedded currently has no implicit `PATH`
discovery and uses `--antigravity-login`. Both current copies return no
selection when a selected model disappears. These are baseline facts, not
accepted 0.2.0 behavior; later implementation todos close them under this
contract.

| Contract surface | Standalone sealed restore | Embedded sealed restore | 0.2.0 target |
| --- | --- | --- | --- |
| Root exports | Same 33 runtime exports and public type exports | Same | Preserve root API |
| CLI commands/help | Same eight commands, `--project`/`-p`, same help | Same | Preserve |
| Missing `--project`/`-p` value | Silently falls back to default or accepts a flag as the name | Same | Nonzero; exact `Missing value for --project` stderr |
| Storage | Same project/global paths, JSON bytes, and `0600` files | Same | Preserve |
| Local auth methods | Same API key/env/external OAuth/none policy | Same | Preserve reviewed local policy |
| Google CLIProxyAPI login | `--login` | `--antigravity-login` | `--antigravity-login` |
| Claude CLIProxyAPI login | `--claude-login` | `--claude-login` | `--claude-login` |
| CLIProxyAPI `PATH` lookup | Implicit lookup present | No implicit lookup | No implicit lookup |
| Remote catalog | Static local data; no remote authority | Static local data; no remote authority | Inert metadata only |
| Removed selected model | Resolves `undefined` | Resolves `undefined` | Resolve immutable historical selection |
