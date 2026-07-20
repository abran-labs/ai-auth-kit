#!/bin/sh
set -eu

registry='https://registry.npmjs.org/'
package='@abran-labs/ai-auth-kit'

fail() {
  printf '%s\n' "npm release preflight failed: $1" >&2
  exit 1
}

require_value() {
  [ -n "$1" ] || fail "missing $2"
}

is_exact_npm_e404() {
  printf '%s\n' "$1" | awk '
    /^npm error code / {
      code_lines += 1
      if ($0 == "npm error code E404") exact_e404 += 1
    }
    END { exit !(code_lines == 1 && exact_e404 == 1) }
  '
}

require_value "${RELEASE_TARBALL:-}" RELEASE_TARBALL
require_value "${RELEASE_TARBALL_SHA256:-}" RELEASE_TARBALL_SHA256
require_value "${RELEASE_TARBALL_SRI:-}" RELEASE_TARBALL_SRI
require_value "${RELEASE_TARBALL_FILENAME:-}" RELEASE_TARBALL_FILENAME
require_value "${RELEASE_SOURCE_TAG_SHA:-}" RELEASE_SOURCE_TAG_SHA
[ -f "$RELEASE_TARBALL" ] || fail "tarball is not a file"
[ "${NPM_CONFIG_REGISTRY:-$registry}" = "$registry" ] || fail "registry must be $registry"
printf '%s' "$RELEASE_SOURCE_TAG_SHA" | grep -Eq '^[0-9a-f]{40}$' || fail "source tag SHA is invalid"

if ! node - "$RELEASE_TARBALL" "$RELEASE_TARBALL_SHA256" "$RELEASE_TARBALL_SRI" "$RELEASE_TARBALL_FILENAME" <<'NODE'
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const [tarball, expectedShaLine, expectedSri, expectedFilename] = process.argv.slice(2);
const bytes = readFileSync(tarball);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const sri = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
if (expectedShaLine !== `${sha256}  ${expectedFilename}` || expectedSri !== sri) process.exit(1);
NODE
then
  fail "tarball SHA-256 or SRI mismatch"
fi

if [ -n "${RELEASE_TARBALL_INVENTORY:-}" ]; then
  [ -f "$RELEASE_TARBALL_INVENTORY" ] || fail "inventory is not a file"
  tar -tzf "$RELEASE_TARBALL" | sed 's#^package/##' | sed '/^$/d' | LC_ALL=C sort > "${RELEASE_TARBALL}.inventory"
  cmp -s "${RELEASE_TARBALL}.inventory" "$RELEASE_TARBALL_INVENTORY" || fail "tarball inventory mismatch"
  rm -f "${RELEASE_TARBALL}.inventory"
fi

if [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] && [ -n "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]; then
  [ -z "${NODE_AUTH_TOKEN:-}" ] || fail "ambiguous GitHub OIDC and npm token authentication"
  [ "${NPM_CONFIG_PROVENANCE:-}" = 'true' ] || fail "OIDC publish requires npm provenance"
  [ "${GITHUB_REPOSITORY:-}" = 'abran-labs/ai-auth-kit' ] || fail "GitHub OIDC repository context is invalid"
  case "${GITHUB_WORKFLOW_REF:-}" in
    'abran-labs/ai-auth-kit/.github/workflows/npm-release.yml@'*) ;;
    *) fail "GitHub OIDC workflow context is invalid" ;;
  esac
  [ "${GITHUB_JOB:-}" = 'publish' ] || fail "GitHub OIDC job context is invalid"
  [ "${RELEASE_GITHUB_ENVIRONMENT:-}" = 'npm-production' ] || fail "GitHub OIDC environment context is invalid"
  authentication_mode='oidc'
elif [ -n "${NODE_AUTH_TOKEN:-}" ]; then
  authentication_mode='token'
else
  fail "no GitHub OIDC or npm token authentication path configured"
fi

npm ping --registry=https://registry.npmjs.org/ >/dev/null || fail "official npm registry ping failed"
if [ "$authentication_mode" = 'token' ]; then
  principal=$(npm whoami) || fail "npm principal lookup failed"
  require_value "$principal" "npm principal"

  packages=$(npm access ls-packages @abran-labs --json) || fail "scope authority lookup failed"
  node -e 'const value = JSON.parse(process.argv[1]); if (!["read-write", "write", "admin"].includes(value[process.argv[2]])) process.exit(1)' "$packages" "$package" || fail "principal lacks package authority"

  members=$(npm org ls abran-labs --json) || fail "organization authority lookup failed"
  node -e 'const value = JSON.parse(process.argv[1]); if (!Object.hasOwn(value, process.argv[2])) process.exit(1)' "$members" "$principal" || fail "principal is not an organization member"
fi

if tags=$(npm view "$package" dist-tags --registry=https://registry.npmjs.org/ --json 2>&1); then
  versions=$(npm view "$package" versions --registry=https://registry.npmjs.org/ --json 2>&1) || fail "versions lookup failed"
elif is_exact_npm_e404 "$tags"; then
  tags='{}'
  versions='[]'
else
  fail "tag lookup failed"
fi
if node -e 'const versions = JSON.parse(process.argv[1]); if (!Array.isArray(versions) || !versions.every((version) => typeof version === "string")) process.exit(1); if (versions.includes(process.argv[2])) process.exit(2)' "$versions" "${RELEASE_VERSION:-1.0.0}"; then
  :
else
  case "$?" in
    2) fail "package version already exists" ;;
    *) fail "versions lookup is invalid" ;;
  esac
fi
if node -e 'const tags = JSON.parse(process.argv[1]); if (tags === null || Array.isArray(tags) || typeof tags !== "object" || !Object.values(tags).every((tag) => typeof tag === "string")) process.exit(1); if (Object.values(tags).includes(process.argv[2])) process.exit(2)' "$tags" "${RELEASE_VERSION:-1.0.0}"; then
  :
else
  case "$?" in
    2) fail "version is already referenced by an npm tag" ;;
    *) fail "tags lookup is invalid" ;;
  esac
fi

npm publish --dry-run --access public "$RELEASE_TARBALL" >/dev/null || fail "exact tarball npm dry run failed"
if [ "$authentication_mode" = 'token' ]; then
  printf '%s\n' "npm release preflight passed for $principal"
else
  printf '%s\n' "npm release preflight passed for GitHub OIDC context; npm publish validates trusted publisher configuration"
fi
