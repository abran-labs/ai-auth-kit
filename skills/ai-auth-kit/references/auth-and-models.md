# Authentication and models — 1.0.0

## Provider policy

| Provider | API key | Environment | Account flow |
| --- | --- | --- | --- |
| OpenAI | Yes | `OPENAI_API_KEY` | Built-in browser OAuth; device fallback. |
| GitHub Copilot | No | `GITHUB_TOKEN`, `GH_TOKEN`, `COPILOT_GITHUB_TOKEN` | Built-in device OAuth. |
| Anthropic | Yes | `ANTHROPIC_API_KEY` | Optional CLIProxyAPI. |
| Google | Yes | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | Optional CLIProxyAPI. |
| Other catalog provider | Only when local policy allows | Only known local-policy names | None. |
| Ollama compatibility entry | Optional | `OLLAMA_API_KEY` | No-auth also allowed. |

Always inspect `provider.authMethods`. Local reviewed policy is authoritative.

## Interactive login behavior

`loginWithPrompts()`:

1. Calls `ready()`.
2. Selects provider when host did not provide one.
3. Shows only methods valid under local policy. Environment auth appears only when a known
   variable currently has a non-empty value.
4. API key: password prompt → separate secret store.
5. Environment: save variable name only; multiple present variables produce a choice.
6. OpenAI/GitHub Copilot: built-in account flow.
7. Anthropic/Google account auth: explicit risk confirmation → verified CLIProxyAPI provision →
   upstream login → metadata save.
8. Cancellation, warning decline, unavailable flow, or failure returns/saves nothing.

## Account OAuth runtime

- OpenAI uses loopback browser callback, state, and PKCE; browser failure falls back to device
  flow. Runtime refreshes near expiry, then returns `Authorization` and optional
  `ChatGPT-Account-Id`; base URL is `https://chatgpt.com/backend-api/codex`.
- GitHub Copilot uses device flow and returns Bearer token headers for
  `https://api.githubcopilot.com`.
- OAuth tokens remain in secret storage; metadata references them.

## CLIProxyAPI boundary

Only Anthropic/Google account auth. It is unofficial and may conflict with provider terms or
cause account restriction. Confirmation defaults false and must precede provision/login.

- Default local URL: `http://localhost:8317`.
- Automatic provision: Linux x64/arm64 only.
- Anthropic login flag: `--claude-login`; Google: `--antigravity-login`.
- Environment `PATH` ignored. Explicit binary must be absolute, owned/safe, non-symlinked,
  executable, and not group/world writable.
- Download validates release metadata, asset/checksum identity, digest, size, and archive shape.
- Checksums detect changed bytes; they do not independently prove publisher identity.

## Catalog/model lifecycle

Managed runtime starts with bundled snapshot, conditionally fetches Models.dev, then uses valid
cache or bundled snapshot on failure. Five-minute guard prevents excessive refresh; concurrent
refreshes share one request. Host may start hourly attempts and must call `dispose()` at shutdown.

Remote content may describe providers/models only. It cannot add commands, paths, flags, headers,
bodies, credentials, OAuth behavior, environment names, or auth methods.

`selectModel()` saves a snapshot. `resolveSelection()` uses live catalog first and saved snapshot
second, preserving a prior valid selection after upstream removal.
