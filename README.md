# AI Auth Kit

A small TypeScript library and CLI for saving AI provider credentials and choosing a model.

The important design choice: **storage belongs to the project using this library**. AI Auth Kit does not secretly claim one global config for every tool. Each app can keep its own provider, model, and auth settings.

## What It Includes

- OpenCode/models.dev-style provider catalog
- typed library API
- project-local storage helpers
- CLI commands for sign-in and model selection
- separate local secret store written with `0600` permissions
- prompt helpers built with `@clack/prompts`

## Local Development

```bash
bun install --frozen-lockfile
bun run check
bun run test:types
bun test
bun run build
bun run src/cli.ts --help
```

`bunfig.toml` sets `minimumReleaseAge = 604800`. This filters newly resolved npm package versions to versions at least seven days old. It does not retroactively audit versions already recorded in `bun.lock`, and it does not apply to Git dependencies.

## Library Usage

Most projects should use this one-liner:

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");

await kit.ready(); // Refreshes Models.dev when available; sync list APIs remain offline-safe.
```

That stores config under:

```text
./.ai-auth-kit/my-tool/config.json
./.ai-auth-kit/my-tool/secrets.json
```

Full example:

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");

await kit.saveEnvCredential("openai", "OPENAI_API_KEY");
await kit.selectModel("openai", "gpt-5-mini");

const selection = await kit.resolveSelection();
const auth = await kit.runtimeAuth("openai");

console.log(selection?.provider.name, selection?.model.name);
console.log(auth.env);
```

If a project wants complete control, pass storage explicitly:

```ts
import { createAuthKit, projectStorage } from "@abran-labs/ai-auth-kit";

const kit = createAuthKit({
  storage: projectStorage("my-tool")
});
```

There is also `globalStorage()` for tools that intentionally want shared global config, but it is opt-in.

## CLI

Anthropic and Google account sign-in appear in the interactive auth picker as account-auth options with inline risk text.

When a user picks Anthropic or Google account sign-in, AI Auth Kit first shows the risk confirmation, then ensures `cli-proxy-api` is available, then launches the matching CLIProxyAPI account login flow. On Linux x64/arm64 it prefers an existing trusted local `cli-proxy-api` on `PATH`; otherwise it downloads the exact current GitHub release asset, verifies its API SHA-256 digest and the release `checksums.txt`, then writes it to the project's private AI Auth Kit cache. Other platforms require a separately installed CLIProxyAPI binary.

The CLI also defaults to project-local storage:

```bash
ai-auth-kit init --project my-tool
ai-auth-kit providers --project my-tool
ai-auth-kit login openai --project my-tool
ai-auth-kit models openai --project my-tool
ai-auth-kit use openai gpt-5-mini --project my-tool
ai-auth-kit current --project my-tool
ai-auth-kit doctor --project my-tool
ai-auth-kit catalog status --project my-tool
ai-auth-kit catalog refresh --project my-tool
```

Without `--project`, the project name is `default`.

Catalog metadata refreshes when interactive and catalog CLI commands run. `listProviders`,
`listModels`, and `getModel` remain synchronous over the current snapshot/cache. Remote
metadata only supplies provider/model facts; local reviewed auth policies remain authoritative.
Selected models retain an immutable local provider/model snapshot so a removed upstream model
can still resolve offline. Legacy selections remain unchanged until the user selects again.

## How Tools Use It

```ts
const selection = await kit.resolveSelection();
if (!selection) throw new Error("No model selected");

const auth = await kit.runtimeAuth(selection.provider.id);

// Pass auth.env to AI SDK, pi-ai, OpenRouter, or your own client.
```

## VoxType Direction

A VoxType integration can build on this without making the library VoxType-specific:

```bash
voxtype-tools auth login
voxtype-tools model
voxtype-tools postprocess
```

Then VoxType can call:

```toml
[output.post_process]
command = "voxtype-tools postprocess"
timeout_ms = 30000
```

## Design Choice

OpenCode is a good UX reference, but this package does not depend on OpenCode internals. Anthropic/Google account sign-in is provisioned on first use through a dedicated CLIProxyAPI adapter.
