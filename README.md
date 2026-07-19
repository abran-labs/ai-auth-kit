# AI Auth Kit

AI Auth Kit is a TypeScript library for provider authentication, model selection, and private
project storage. Host applications keep ownership of command names, routing, output, prompts, and
provider API calls.

[Read the documentation](https://abran-labs.github.io/ai-auth-kit/) ·
[Browse the source](https://github.com/abran-labs/ai-auth-kit)

## Install the exact library release

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

Import from the package root:

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();

const provider = kit.listProviders()[0];
if (provider !== undefined) {
  console.log(provider.id, kit.listModels(provider.id).length);
}
```

The exact package version controls the direct dependency. Commit `bun.lock` and use
`bun install --frozen-lockfile` in CI to preserve the full dependency tree.

## Library package vs agent skill

| Surface | Value |
| --- | --- |
| `@abran-labs/ai-auth-kit@1.0.0` | Runtime APIs used by the host application. |
| AI Auth Kit agent skill `1.0.0` | Local implementation knowledge for Claude Code, OpenCode, and Codex. |

Modern coding agents can inspect a package, but reconstructing provider policy, OAuth ordering,
storage boundaries, and host-owned prompt patterns costs time and can miss security constraints.
The optional skill gives the agent that version-matched knowledge immediately. It does not add
runtime code, install the package, or create a generic AI Auth Kit command.

Install the separately versioned agent skill with its reviewed curl installer:

```sh
curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh
```

The skill installer is separate from the npm library. It verifies a versioned manifest and archive,
installs one canonical payload at `~/.agents/skills/ai-auth-kit`, and creates only the Claude
compatibility symlink at `~/.claude/skills/ai-auth-kit`.

## Host-owned authentication

Authentication behavior comes from reviewed local policy. Remote catalog data can describe
providers and models, but it cannot add commands, executable paths, request headers, or login
behavior.

| Provider kind | Available choices |
| --- | --- |
| OpenAI | API key, `OPENAI_API_KEY`, or account OAuth |
| GitHub Copilot | Supported token environment variables or account OAuth |
| Anthropic | API key, `ANTHROPIC_API_KEY`, or optional CLIProxyAPI account auth |
| Google | API key, supported Gemini/Google environment variables, or optional CLIProxyAPI account auth |
| Other catalog providers | API key/environment auth only when local policy allows it |
| Ollama compatibility entry | No auth, or `OLLAMA_API_KEY` when needed |

Use `loginWithPrompts()` for a complete host-owned prompt flow, or compose `pickProvider()`,
`pickModel()`, and `pickAuthMethod()` with a custom `PromptAdapter`. Cancellation and declined
warnings return without saving credentials.

CLIProxyAPI is optional supporting infrastructure for Anthropic and Google account login. It is
not needed for API keys or environment variables. Its flow presents provider-terms and account-risk
warnings before provisioning.

## Credentials and privacy

Project storage is default:

```text
./.ai-auth-kit/<project>/config.json
./.ai-auth-kit/<project>/secrets.json
```

`config.json` contains credential metadata and selected-model state. API keys and tokens live in
separate `secrets.json`; environment auth stores only the variable name. Managed directories use
mode `0700`, files use `0600`, writes are atomic, and symlinks are rejected. Global storage is
opt-in under `$XDG_CONFIG_HOME/<app>` or `~/.config/<app>`.

Models.dev metadata is cached separately under `$XDG_CACHE_HOME/ai-auth-kit` or `~/.cache`.
Selected providers/models include immutable snapshots so prior state remains resolvable after an
upstream catalog change.

## Documentation

- [60-second quickstart](https://abran-labs.github.io/ai-auth-kit/start/quickstart/)
- [Library guide](https://abran-labs.github.io/ai-auth-kit/guides/library/)
- [Providers and auth](https://abran-labs.github.io/ai-auth-kit/guides/providers-auth/)
- [Agent skill](https://abran-labs.github.io/ai-auth-kit/guides/agent-skill/)
- [Storage and privacy](https://abran-labs.github.io/ai-auth-kit/guides/storage-privacy/)
- [Library API](https://abran-labs.github.io/ai-auth-kit/reference/api/)
- [Security model](https://abran-labs.github.io/ai-auth-kit/reference/security/)

MIT licensed.
