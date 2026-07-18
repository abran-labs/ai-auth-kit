#!/bin/sh
# Immutable bootstrap: it authenticates one native manager and delegates every lifecycle mutation.
set -eu

MANAGER_X64_URL='https://github.com/abran-labs/ai-auth-kit/releases/download/v0.2.0/ai-auth-kit-installer-manager-linux-x64-musl'
MANAGER_ARM64_URL='https://github.com/abran-labs/ai-auth-kit/releases/download/v0.2.0/ai-auth-kit-installer-manager-linux-arm64-musl'
MANAGER_X64_SHA256='7904b839da2c1337ed278f3d899335e5df2307af8e509cc7389626fbe227f653'
MANAGER_ARM64_SHA256='db2a2b080a483fb36576108a03254ee0ad6183fe645dd01a432adc792601f8ef'

die() { printf '%s\n' "error: $*" >&2; exit 1; }
usage() { printf '%s\n' 'Usage: install.sh [manager flags]' 'Downloads one pinned native Linux installer manager then forwards flags unchanged.'; }

case "${1-}" in --help) usage; exit 0 ;; esac
[ "$(uname -s)" = Linux ] || die "unsupported operating system: $(uname -s)"
case "$(uname -m)" in
  x86_64|amd64) manager_url=$MANAGER_X64_URL; manager_sha=$MANAGER_X64_SHA256 ;;
  aarch64|arm64) manager_url=$MANAGER_ARM64_URL; manager_sha=$MANAGER_ARM64_SHA256 ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac
case "$manager_sha" in *'__AI_AUTH_KIT_'*) die 'bootstrap manager digest has not been generated' ;; esac
command -v curl >/dev/null 2>&1 || die 'missing required command: curl'
command -v sha256sum >/dev/null 2>&1 || die 'missing required command: sha256sum'
umask 077
tmp=$(mktemp -d "${TMPDIR:-/tmp}/ai-auth-kit-manager.XXXXXX") || die 'could not create private temporary directory'
trap 'rm -f "$tmp/manager"; rmdir "$tmp" 2>/dev/null || true' EXIT HUP INT TERM
curl -fsSL --connect-timeout 10 --max-time 60 "$manager_url" -o "$tmp/manager" || die 'manager download failed'
chmod 0700 "$tmp/manager"
exec 3<"$tmp/manager"
actual_sha=$(sha256sum "/proc/self/fd/3" | awk '{print $1}')
[ "$actual_sha" = "$manager_sha" ] || die 'pinned manager SHA-256 mismatch'
exec "/proc/self/fd/3" "$@"
