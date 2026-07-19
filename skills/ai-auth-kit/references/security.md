# Storage and security — 1.0.0

## Storage locations

Project default:

```text
./.ai-auth-kit/<project>/config.json
./.ai-auth-kit/<project>/secrets.json
```

Opt-in global:

```text
$XDG_CONFIG_HOME/<app>/
~/.config/<app>/
```

Catalog cache is separate under `$XDG_CACHE_HOME/ai-auth-kit` or `~/.cache/ai-auth-kit`.

`config.json` contains credential metadata and selected-model state. `secrets.json` contains API
keys/OAuth token material by secret reference. Environment auth persists variable name only.

## Filesystem controls

- Managed directories: `0700`.
- Files: `0600`.
- Existing paths must be owned regular files/directories and not group/world writable.
- Descriptor-anchored atomic writes; symlinks and non-regular files are rejected.
- Credential removal/reconciliation deletes unreferenced secret material.
- Boundary does not isolate against another hostile process running as same user.

Never place secrets in source, skill tree, logs, command arguments, `config.json`, catalog metadata,
or agent conversation. Never print `RuntimeAuth.external.headers` or environment values.

## Trust boundaries

| Input | Trusted for | Never trusted for |
| --- | --- | --- |
| Local provider policy | Auth methods, known environment names, adapter eligibility | Secret values. |
| Models.dev | Provider/model metadata | Commands, paths, headers, auth behavior, credentials. |
| Saved state | Validated local metadata and references | Executable instructions. |
| CLIProxyAPI release | Bytes after validation | Publisher identity solely from checksum. |

## Failure handling

- Missing/mismatched package version: stop and use exact checker remediation.
- Unknown provider/model or unsupported method: surface error; do not invent fallback policy.
- Empty environment variable: do not save environment credential.
- OAuth cancellation/terminal failure: no credential saved.
- CLIProxyAPI warning decline or provision/login failure: no metadata saved.
- Corrupt/untrusted storage path: fail closed; do not relax ownership/mode/symlink checks.
- Catalog refresh failure: valid cache, then bundled snapshot; never rewrite auth state.

## Review checklist

- Host chose project/global storage deliberately.
- Secret values never logged or serialized into config metadata.
- Remote metadata cannot reach execution or auth policy.
- Optional account automation warning remains explicit and defaults to decline.
- Runtime auth scoped to selected provider and handed directly to host provider client.
