# AI Auth Kit

AI Auth Kit `0.2.0` is a TypeScript library and CLI for provider authentication, model selection, and project owned credential storage. The package is consumed from Git by an exact commit. It isn't published to npm or GitHub Packages.

## Immutable Git consumption

Use Bun with the dependency grammar `github:abran-labs/ai-auth-kit#<40-lowercase-hex-commit>`. Resolve and review the complete commit before changing `package.json`, then confirm that `bun.lock` records the same commit. Branches, tags, abbreviated commits, local package paths, workspace aliases, symlinks, and copied source aren't supported consumption methods.

The package has no lifecycle build scripts. Bun loads tracked `src/index.ts`. Node ESM loads tracked `dist/index.js`, TypeScript loads tracked `dist/index.d.ts`, and the `ai-auth-kit` binary loads tracked `dist/cli.js`. Consumer installs should disable dependency scripts and use a frozen lock.

This command block uses `AI_AUTH_KIT_GIT_SPEC`. Production must set it to the GitHub dependency grammar above. Documentation QA sets it to an exact commit in a local bare Git fixture, so the commands run without claiming a public commit exists.

<!-- docs-smoke:immutable-git-consumer -->
```sh
cd "$DOCS_FIXTURE_ROOT/consumer"
bun add --ignore-scripts --exact "$AI_AUTH_KIT_GIT_SPEC"
bun install --ignore-scripts --frozen-lockfile
bun -e 'import { fixtureVersion } from "@abran-labs/ai-auth-kit"; if (fixtureVersion !== "0.2.0") process.exit(1)'
```

An online install must seed Bun's Git cache. A later `bun install --offline --frozen-lockfile` can use that exact commit only while its required cache entries remain available.

## Library API

The package root exports the factories, storage types, catalog runtime, picker helpers, account OAuth helpers, CLIProxyAPI adapter, and public types listed by `src/index.ts` and enforced by `test/contract.test.ts`. Import from the package root, not internal files.

Project storage is the default:

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();

const providers = kit.listProviders();
const provider = providers[0];
if (provider !== undefined) {
  const model = kit.listModels(provider.id)[0];
  if (model !== undefined) await kit.selectModel(provider.id, model.id);
}
```

For explicit storage selection:

```ts
import { createAuthKit, globalStorage, projectStorage } from "@abran-labs/ai-auth-kit";

const projectKit = createAuthKit({ storage: projectStorage("my-tool") });
const sharedKit = createAuthKit({ storage: globalStorage("my-tool") });
void projectKit;
void sharedKit;
```

`projectStorage("my-tool")` writes `./.ai-auth-kit/my-tool/config.json` and `secrets.json`. `globalStorage("my-tool")` writes below `$XDG_CONFIG_HOME/my-tool`, or `~/.config/my-tool` when that variable is unset. Managed directories use mode `0700`; persisted JSON files use mode `0600`. API keys live in the separate secret file. Environment credentials save the environment variable name, not its value.

Provider authentication policy is reviewed local code. Remote catalog data cannot add commands, login behavior, executable paths, headers, request bodies, or credentials. `AuthKit` supports API key, environment, external OAuth, and no-auth credentials where the selected local provider policy allows them. OpenAI and GitHub Copilot account OAuth use the package's local OAuth adapters. Anthropic and Google account auth use the CLIProxyAPI adapter after the interactive risk confirmation.

CLIProxyAPI accepts only an explicit validated executable or a verified cached download. Environment `PATH` is ignored. Download handling validates the release response, archive layout, release checksum file, and selected archive digest before opening the executable through a held file descriptor. Checksums detect changed bytes but don't identify who produced them, so they aren't an independent provenance guarantee.

## CLI

The following help is copied from the executable contract fixture and checked against actual `--help` output:

```text
ai-auth-kit

Usage:
  ai-auth-kit init [--project name]
  ai-auth-kit providers [--project name]
  ai-auth-kit login [provider] [--project name]
  ai-auth-kit models [provider] [--project name]
  ai-auth-kit use [provider] [model] [--project name]
  ai-auth-kit current [--project name]
  ai-auth-kit doctor [--project name]
  ai-auth-kit catalog <status|refresh> [--project name]
  ai-auth-kit path [--project name]

Options:
  --project name, -p name  Select project storage.
  --version, -V            Print version.
  --help, -h               Print help.

Storage defaults to ./.ai-auth-kit/<project-name>.
Project name defaults to "default".
```

`login` and `use` can prompt. The noninteractive commands below run in documentation QA. Catalog status begins with the bundled snapshot until a valid cache or network refresh replaces it.

<!-- docs-smoke:cli-noninteractive -->
```sh
cd "$DOCS_FIXTURE_ROOT"
ai-auth-kit --help
ai-auth-kit --version
ai-auth-kit -V
ai-auth-kit init --project docs-smoke
ai-auth-kit path --project docs-smoke
ai-auth-kit catalog status --project docs-smoke
ai-auth-kit doctor --project docs-smoke
```

## Models.dev freshness and history

The live source is `https://models.dev/api.json`. Successful responses are parsed through a metadata-only schema and saved at `$XDG_CACHE_HOME/ai-auth-kit/models-dev-v1.json`, or `~/.cache/ai-auth-kit/models-dev-v1.json`. Cache files record the source URL, ETag when supplied, fetch time, source content SHA-256, and normalized provenance.

`ready()`, interactive catalog users, and `catalog refresh` can refresh metadata. Normal refresh attempts are guarded for five minutes, conditional requests use ETags when available, and `startCatalogRefresh()` opts a long-running process into hourly attempts. A timeout, HTTP failure, malformed body, unsafe cache, or interrupted write falls back to the last valid cache. With no valid cache, the tracked snapshot is used. Provider and model totals aren't fixed because the source changes.

`listProviders()`, `listModels()`, and `getModel()` read the current in-memory view synchronously. A selected model stores an immutable provider and model snapshot. If a later catalog removes it, new selection lists hide it while `resolveSelection()` can still return the saved historical selection. Refresh failures don't rewrite credentials or selections.

## Linux installer and lifecycle

The standalone installer supports only Linux x64 and arm64 CLI targets for glibc and musl. The bootstrap manager binaries are static musl executables. Musl CLI artifacts need `libstdc++.so.6` and `libgcc_s.so.1`; on Alpine the release preflight reports `apk add --no-cache libstdc++` when they're missing.

No public source or release has been asserted by this documentation. Public deployment still needs explicit approval. After a release exists and its source commit is independently verified, fetch `install.sh` only from `https://raw.githubusercontent.com/abran-labs/ai-auth-kit/<40-lowercase-hex-commit>/install.sh`. Set `AI_AUTH_KIT_INSTALLER_URL` to that immutable URL. The executable command is:

<!-- docs-smoke:installer-help -->
```sh
curl -fsSL "$AI_AUTH_KIT_INSTALLER_URL" | sh -s -- --help
```

The bootstrap identifies Linux architecture, downloads its pinned manager, verifies the embedded SHA-256, then executes that opened file descriptor. It doesn't fetch CLI release assets or choose a release.

The public manager help is mode-specific:

```text
Usage:
  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE [--version vX.Y.Z] [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE --update [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --rollback [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --uninstall [--dry-run] [--force] [--yes]

Install/update read DIRECTORY and require exactly one signed receipt. rollback/uninstall require but do not read DIRECTORY; they use retained managed state.
```

Install anchors the supplied release directory, opens manifest/checksum metadata and the selected artifact through held no-follow regular-file descriptors, verifies signed coordinates and bytes, then creates a new immutable object and generation. Artifact type, size, and digest checks happen before any FD-based `ldd` prerequisite inspection. Update performs the same release verification, then creates a generation whose state points to the previously active generation. `--version` constrains install/update to the matching manifest tag and conflicts with rollback/uninstall.

Rollback does not load a manifest, checksum file, receipt, or release artifact. It follows the retained current generation's validated state to its retained prior generation and managed object, then creates a new rollback generation. Uninstall also uses only held local managed state. The parser still requires `--release-dir DIRECTORY` for both commands, but those modes do not read `DIRECTORY` and need no receipt.

This executable block is local QA, not public installation guidance. It runs the canonical compiled manager with two locally signed release fixtures and its separate fixture key. The nonexistent directory passed to rollback/uninstall proves those modes only satisfy the parser requirement.

<!-- docs-smoke:manager-local-lifecycle -->
```sh
"$AI_AUTH_KIT_MANAGER" --help
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_RELEASE_DIR" --test-attestation "$AI_AUTH_KIT_TEST_BUNDLE" --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UPDATE_RELEASE_DIR" --test-attestation "$AI_AUTH_KIT_UPDATE_TEST_BUNDLE" --update --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UNUSED_RELEASE_DIR" --rollback --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UNUSED_RELEASE_DIR" --uninstall --yes
```

Expected public install/update inputs include a public-key-valid signed bundle and a release process that actually verified GitHub provenance. No such public release or verification is claimed here. GitHub attestations can be claimed only when `gh attestation verify` succeeds for the expected repository, workflow, and SLSA predicate. Local QA uses a separately built test manager, a separate fixture key, and `--test-attestation`; that proves local transaction behavior, not GitHub provenance. Public binaries reject the fixture mode. `SHA256SUMS` has no public checksum-only fallback: without the valid signed bundle, public install/update fails.

The manager's normal user-local threat model protects state owned by the invoking user against unsafe files and paths found during validation. It isn't a boundary against an actively hostile process running as the same UID after validation. See `docs/installer-manager-trust.md` for filesystem, uninstall, and same-UID limits.

Git consumers update by reviewing a new full commit, replacing the declared SHA, and regenerating and checking the frozen lock. Standalone install/update need a complete signed release input. Rollback uses the retained prior managed generation; uninstall uses local managed state. During uninstall, safe managed entries can be removed before a later unsafe entry is found. The unsafe entry is preserved and teardown stops; earlier safe removals are not rolled back. The stable activation location and managed root remain, as described in the trust contract.

## Dependency age policy

`bunfig.toml` sets `minimumReleaseAge = 604800`, a seven-day cooldown applied when Bun resolves a new npm package version. It doesn't retroactively age-audit versions already in `bun.lock`, and it doesn't apply to Git dependencies. Existing installs use the frozen lock. See `docs/dependency-policy.md` for the direct dependency list and audit limits.

## VoxType migration

VoxType migration is a consumer task, not a completed release claim. It must wait for the approved public source step. The migration contract is: choose one reviewed public 40-hex commit, declare that exact Git dependency, confirm the same SHA in `bun.lock`, remove old vendored or local-source references, and run VoxType's own frozen install, typecheck, tests, build, release verification, and auth boundary QA. Keep the prior tree manifest until online and preseeded-offline disposable migrations both pass. A failed Git fetch, cache failure, or type mismatch must leave the existing VoxType workspace unchanged.

AI Auth Kit doesn't claim VoxType command names or config syntax here because those belong to the VoxType source and later migration todos.
