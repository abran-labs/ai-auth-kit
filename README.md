![AI Auth Kit banner showing an abstract authorization card beside the product name](.github/assets/ai-auth-kit-banner.svg)

# AI Auth Kit

**AI authentication, made easy.**

Let users connect any AI provider to your tool — an API key, their ChatGPT plan, or a Claude
account — then pick a model. Works in CLIs and in multi-user web apps.

## Install

Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.1.0 is published.

```sh
bun add @abran-labs/ai-auth-kit@1.1.0
```

## Use it in a CLI

```ts
import { createProjectAuthKit, loginWithPrompts } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await loginWithPrompts(kit);

const auth = await kit.runtimeAuth("openai");
```

## Use it in a web app

Each user or workspace connects their own provider from a ready-made panel. Your server stores
the credentials and calls the model.

```ts
import { createConnectService, createMemoryPendingFlowStore, createMemoryTenantStore } from "@abran-labs/ai-auth-kit";

const service = createConnectService({
  tenantStore: createMemoryTenantStore(),
  pendingFlows: createMemoryPendingFlowStore(),
  agentName: "My App",
  hostId: "urn:uuid:…",
  chatGptPlan: { enabled: true },
});

// POST /ai/connect → await service.handle(workspaceId, body)
// Before a model call → await service.runtime(workspaceId)
```

```tsx
import { ConnectPanel, createFetchConnectTransport } from "@abran-labs/ai-auth-kit/react";

<ConnectPanel transport={createFetchConnectTransport("/ai/connect")} />;
```

## Install the skill

The optional, version-matched agent skill gives coding agents the library's implementation
guidance without adding runtime code.

Pending: use this exact command after the agent-skill-v1.1.0 release asset is uploaded.

```sh
curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.1.0/install-agent-skill.sh | sh
```

## Providers

| Provider | Available choices |
| --- | --- |
| OpenAI | API key, `OPENAI_API_KEY`, or Sign in with ChatGPT (ChatGPT plan) |
| GitHub Copilot | `GITHUB_TOKEN`, `GH_TOKEN`, or `COPILOT_GITHUB_TOKEN`, plus built-in account OAuth |
| Anthropic | API key, `ANTHROPIC_API_KEY`, or optional CLIProxyAPI account auth |
| Google | API key, supported Gemini/Google environment variables, or optional CLIProxyAPI account auth |
| Other catalog providers | API key or environment auth only when source environment names exist |
| Ollama compatibility entry | No auth, or environment auth via `OLLAMA_API_KEY`; no API-key method |

Optional [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) account auth applies only to
Anthropic and Google. It is unofficial and may break provider terms; API keys and environment
variables do not need it.

## Why AI Auth Kit

Every AI tool rebuilds the same API-key, sign-in, and model-picker flows. AI Auth Kit does it once,
with reviewed provider rules and safe credential storage, while your tool keeps control of its
commands, UI, and model calls.

## Links

- [Changelog](CHANGELOG.md)
- [Hosted mode guide](docs-site/src/content/docs/guides/hosted.md)
- [Web panel guide](docs-site/src/content/docs/guides/web-connect.md)
- [Providers and sign-in](docs-site/src/content/docs/guides/providers-auth.md)
- [Security](docs-site/src/content/docs/reference/security.md)

MIT licensed.
