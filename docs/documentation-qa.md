# Documentation QA contract

This maintainer document keeps executable documentation fixtures out of the human README. It is
not installation guidance and does not claim public release availability.

## Immutable Git consumer fixture

`AI_AUTH_KIT_GIT_SPEC` is an exact commit in a local bare Git fixture during QA.

<!-- docs-smoke:immutable-git-consumer -->
```sh
cd "$DOCS_FIXTURE_ROOT/consumer"
bun add --ignore-scripts --exact "$AI_AUTH_KIT_GIT_SPEC"
bun install --ignore-scripts --frozen-lockfile
bun -e 'import { fixtureVersion } from "@abran-labs/ai-auth-kit"; if (fixtureVersion !== "0.2.0") process.exit(1)'
```

## CLI fixture

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

The expected CLI help is:

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

## Installer fixtures

The bootstrap URL and release inputs below are local test fixtures.

<!-- docs-smoke:installer-help -->
```sh
curl -fsSL "$AI_AUTH_KIT_INSTALLER_URL" | sh -s -- --help
```

<!-- docs-smoke:manager-local-lifecycle -->
```sh
"$AI_AUTH_KIT_MANAGER" --help
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_RELEASE_DIR" --test-attestation "$AI_AUTH_KIT_TEST_BUNDLE" --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UPDATE_RELEASE_DIR" --test-attestation "$AI_AUTH_KIT_UPDATE_TEST_BUNDLE" --update --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UNUSED_RELEASE_DIR" --rollback --yes
"$AI_AUTH_KIT_MANAGER" --release-dir "$AI_AUTH_KIT_UNUSED_RELEASE_DIR" --uninstall --yes
```

The expected manager help is:

```text
Usage:
  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE [--version vX.Y.Z] [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE --update [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --rollback [--dry-run] [--force] [--yes]
  ai-auth-kit-installer-manager --release-dir DIRECTORY --uninstall [--dry-run] [--force] [--yes]

Install/update read DIRECTORY and require exactly one signed receipt. rollback/uninstall require but do not read DIRECTORY; they use retained managed state.
```
