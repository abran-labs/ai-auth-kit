# AI Auth Kit

AI Auth Kit gives TypeScript CLI tools one place to authenticate AI providers, choose models,
and keep project credentials private.

Use it as:

- a **library** when your application owns the auth and model-selection experience;
- a **CLI** when a person should configure a project interactively.

[Read the documentation](https://abran-labs.github.io/ai-auth-kit/) ·
[Browse the source](https://github.com/abran-labs/ai-auth-kit)

## Start in 60 seconds

AI Auth Kit is installed from Git. It is not published to npm or GitHub Packages. Pin the
complete public source commit shown here:

```text
bun add --ignore-scripts --exact github:abran-labs/ai-auth-kit#adcb364fa086ec1a854d2b412a5efbd530595b98
bun install --ignore-scripts --frozen-lockfile
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

The SHA above is the latest published source commit, not a package or binary release. Review a
new full SHA before updating it, then confirm `bun.lock` records the same commit.

## First CLI setup

The package installs the `ai-auth-kit` executable. Initialize a named project, then let `login`
and `use` prompt for the provider and model:

```text
ai-auth-kit init --project my-tool
ai-auth-kit login --project my-tool
ai-auth-kit use --project my-tool
ai-auth-kit current --project my-tool
```

Without `--project`, the CLI uses `default` and stores state in
`./.ai-auth-kit/default/`. Run `ai-auth-kit --help` for every command.

## Authentication choices

Authentication behavior comes from reviewed local policy. Remote catalog data can describe
providers and models, but it cannot add commands, executable paths, request headers, or login
behavior.

| Provider kind | Available choices |
| --- | --- |
| OpenAI | API key, `OPENAI_API_KEY`, or account OAuth |
| GitHub Copilot | `GITHUB_TOKEN`, `GH_TOKEN`, or `COPILOT_GITHUB_TOKEN`; account OAuth |
| Anthropic | API key, `ANTHROPIC_API_KEY`, or optional CLIProxyAPI account auth |
| Google | API key, supported Gemini/Google environment variables, or optional CLIProxyAPI account auth |
| Other catalog providers | API key and environment auth only when local policy has known environment variables |
| Ollama compatibility entry | No auth, or `OLLAMA_API_KEY` when needed |

CLIProxyAPI is supporting infrastructure for optional Anthropic and Google account login. It is
not required for API keys or environment variables, and its interactive flow shows a provider
terms and account-risk warning before provisioning anything.

## Credentials and privacy

Project storage is the default:

```text
./.ai-auth-kit/<project>/config.json
./.ai-auth-kit/<project>/secrets.json
```

`config.json` contains credential metadata and the selected model. API keys and tokens go in the
separate `secrets.json`; environment auth stores only the variable name. Managed directories use
mode `0700`, files use `0600`, writes are atomic, and symlinks are not followed. Global storage is
opt-in under `$XDG_CONFIG_HOME/<app>` or `~/.config/<app>`.

Models.dev metadata is cached separately under `$XDG_CACHE_HOME/ai-auth-kit` or `~/.cache`.
Provider and model totals change over time, so the library keeps an immutable snapshot with each
saved selection and can resolve it after an upstream catalog change.

## Support

| Surface | Supported |
| --- | --- |
| Library | Bun and Node ESM consumers using the package root |
| CLI | Tracked `dist/cli.js` through the `ai-auth-kit` binary |
| Source install | Exact 40-character Git commit with frozen Bun lockfile |
| Catalog | Models.dev live metadata, verified cache, then bundled snapshot fallback |
| Optional installer artifacts | Planned for Linux x64/arm64, glibc and musl |

## Linux installer status

The repository contains a security-focused Linux installer manager, but no verified public
release or successful public attestation verification exists yet. Do not present `install.sh` as
the primary installation path. Until a signed release is published and independently verified,
use the exact Git dependency above.

The [Linux installer reference](https://abran-labs.github.io/ai-auth-kit/reference/linux-installer/)
documents the planned flow and trust boundary without claiming that release artifacts exist.

## Go deeper

- [Quickstart](https://abran-labs.github.io/ai-auth-kit/start/quickstart/)
- [Library guide](https://abran-labs.github.io/ai-auth-kit/guides/library/)
- [CLI guide](https://abran-labs.github.io/ai-auth-kit/guides/cli/)
- [Providers and auth](https://abran-labs.github.io/ai-auth-kit/guides/providers-auth/)
- [Storage and privacy](https://abran-labs.github.io/ai-auth-kit/guides/storage-privacy/)
- [Security reference](https://abran-labs.github.io/ai-auth-kit/reference/security/)

MIT licensed.
