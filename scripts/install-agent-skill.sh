#!/bin/sh
set -eu

version='1.0.0'
release="agent-skill-v$version"
archive="ai-auth-kit-skill-$version.tar.gz"
base_url=${AI_AUTH_KIT_SKILL_RELEASE_BASE_URL:-"https://github.com/abran-labs/ai-auth-kit/releases/download/$release"}
target="$HOME/.agents/skills/ai-auth-kit"
claude_target="$HOME/.claude/skills/ai-auth-kit"
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ai-auth-kit-skill.XXXXXX")
trap 'rm -rf "$temporary"' EXIT HUP INT TERM

fail() { printf '%s\n' "AI Auth Kit skill install failed: $1" >&2; exit 1; }
[ "${1:-}" != "--dry-run" ] || dry_run=true
dry_run=${dry_run:-false}

curl --fail --location --silent --show-error "$base_url/manifest.txt" -o "$temporary/manifest.txt"
curl --fail --location --silent --show-error "$base_url/$archive" -o "$temporary/$archive"
archive_hash=$(sed -n 's/^archive_sha256=//p' "$temporary/manifest.txt")
[ "$(printf '%s\n' "$archive_hash" | wc -l)" -eq 1 ] && [ -n "$archive_hash" ] || fail "invalid archive manifest"
actual_hash=$(sha256sum "$temporary/$archive" | awk '{print $1}')
[ "$actual_hash" = "$archive_hash" ] || fail "archive SHA-256 mismatch"

payload=$(sed -n '/^payload:$/,$p' "$temporary/manifest.txt" | sed '1d')
[ -n "$payload" ] || fail "missing payload manifest"
expected=$(printf '%s\n%s\n%s\n%s\n%s' 'ai-auth-kit/' 'ai-auth-kit/PAYLOAD.sha256' 'ai-auth-kit/references/' 'ai-auth-kit/scripts/' "$payload" | awk '{if (NF == 1) print $1; else print "ai-auth-kit/" $2}' | LC_ALL=C sort)
actual=$(tar -tzf "$temporary/$archive" | LC_ALL=C sort)
[ "$actual" = "$expected" ] || fail "archive inventory mismatch"
raw=$(tar -tzf "$temporary/$archive")
[ "$(printf '%s\n' "$raw" | LC_ALL=C sort | uniq -d)" = "" ] || fail "duplicate archive entry"
printf '%s\n' "$raw" | grep -Eq '(^/|//|(^|/)\.\.(/|$))' && fail "unsafe archive path" || :
tar -tvzf "$temporary/$archive" | awk '{if (substr($1, 1, 1) != "-" && substr($1, 1, 1) != "d") exit 1}' || fail "non-regular archive entry"

if [ -e "$target" ] && [ ! -L "$target" ]; then fail "refusing to overwrite user-owned target"; fi
if [ -e "$claude_target" ] && [ ! -L "$claude_target" ]; then fail "refusing to overwrite user-owned Claude target"; fi
if [ "$dry_run" = true ]; then printf '%s\n' "Would install AI Auth Kit skill $version to $target"; exit 0; fi
mkdir -p "$temporary/extract" "$HOME/.agents/skills" "$HOME/.claude/skills"
tar -xzf "$temporary/$archive" -C "$temporary/extract"
for line in $payload; do :; done
while IFS='  ' read -r hash path; do
  [ -n "$hash" ] || continue
  [ "$(sha256sum "$temporary/extract/ai-auth-kit/$path" | awk '{print $1}')" = "$hash" ] || fail "payload SHA-256 mismatch"
done <<EOF
$payload
EOF
rm -f "$target"
mv "$temporary/extract/ai-auth-kit" "$target"
rm -f "$claude_target"
ln -s "$target" "$claude_target"
printf '%s\n' "Installed AI Auth Kit skill $version"
