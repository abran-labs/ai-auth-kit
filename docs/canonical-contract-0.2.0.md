# Canonical 0.2.0 contract

## Identity and consumption

`@abran-labs/ai-auth-kit` and the `ai-auth-kit` executable identify version `0.2.0`. Consumption is Bun Git dependency installation from `github:abran-labs/ai-auth-kit#<40-lowercase-hex-commit>`. No npm or GitHub Packages publication is part of this contract. The declared and locked commits must match.

Tracked source, JavaScript, declarations, CLI output, source maps, and catalog snapshot data must remain fresh at every consumable commit. There are no package lifecycle build scripts.

## Root API

`src/index.ts` is the source of truth. `test/contract.test.ts` freezes the runtime names, while `test/consumer-types.test.ts` verifies source and built type consumers. The root includes `AuthKit`, `CatalogRuntime`, creation and storage functions, picker and account OAuth helpers, CLIProxyAPI provisioning and login helpers, external-auth metadata helpers, `DEFAULT_PROVIDERS`, and the public types from `src/types.ts`.

Consumers import the package root. Internal file paths aren't compatibility surfaces.

## CLI

`src/cli.ts` and `test/fixtures/contracts/cli-help.txt` define the CLI. Stable commands are `init`, `providers`, `login`, `models`, `use`, `current`, `doctor`, `catalog status`, `catalog refresh`, and `path`. Project storage accepts `--project name` and `-p name`. `--version` and `-V` print `0.2.0`; `--help` and `-h` print help. The default project is `default`. A project flag without a usable following value exits nonzero with `Missing value for --project` on stderr.

## Storage and authentication

Project state lives below `./.ai-auth-kit/<sanitized-project>/`. Global state is opt-in below `$XDG_CONFIG_HOME/<sanitized-app>`, with `~/.config` as the XDG fallback. Managed directories use mode `0700`; JSON files use mode `0600`. `config.json` stores credential metadata and selected model state. `secrets.json` stores API-key material by secret reference.

Reviewed local policy controls API key, environment, external OAuth, and no-auth methods. Models.dev metadata cannot add executable or authentication behavior. OpenAI and GitHub Copilot use local account OAuth adapters. Anthropic and Google use the reviewed CLIProxyAPI adapter after risk confirmation. Exact external binary flags aren't a user contract in this document because no captured upstream help fixture is stored here.

CLIProxyAPI execution uses an explicit validated path or a verified cache entry. Environment `PATH` is ignored. Archive shape, checksum text, selected archive digest, file type, permissions, ownership, and opened inode are checked before execution. A checksum authenticates bytes only relative to a trusted expected digest. It doesn't prove publisher identity.

## Catalog and historical selections

Models.dev source data comes from `https://models.dev/api.json`. The normalized cache is versioned and stores source URL, ETag, capture time, content SHA-256, and schema provenance. Failed refreshes use the last valid cache or the tracked snapshot. No catalog size is part of the compatibility contract.

Current catalog entries drive new selections. Saved selections include immutable provider and model metadata. Removal upstream hides the entry from new choices without invalidating the saved historical selection or rewriting auth state.

## Installer scope and trust

Release artifacts cover only Linux x64 and arm64 with glibc and musl CLI variants. Expected public install and update inputs require the signed bundle accepted by the public manager; this repository claims no existing public release or successful public attestation verification. Local QA uses a different manager feature, key, and receipt name. Local fixture success must not be described as a GitHub attestation. `SHA256SUMS` is checked for exact manifest consistency but is not a provenance fallback when the signed bundle is absent.

The installer operates in a normal user-local threat model. It checks ownership, modes, file types, held directories, immutable objects, and activation state, but doesn't claim isolation from an active hostile process with the same UID after validation. Full limits live in `docs/installer-manager-trust.md`.

## Version and publication

Git dependency updates replace one reviewed full SHA with another and update the lock. Installer install/update verify supplied release inputs. Rollback instead uses retained validated generation state and its prior managed object; uninstall uses held local managed state. Both local-state modes still require the `--release-dir` argument syntactically but do not read it and require no receipt. Unsafe uninstall entries are preserved and stop teardown without rolling back earlier safe removals. Public canonical source is published. A tag/release remains pending explicit approval, so this repository documentation names no public release result.
