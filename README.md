# AI Auth Kit

A small TypeScript library and CLI for saving AI provider credentials and choosing a default model.

It does not call models by itself. It gives other tools a clean way to ask:

- which provider should I use?
- which model is selected?
- where should I get auth from?

Model calls can then happen through AI SDK, pi-ai, OpenRouter, or any project-specific client.

## What It Includes

- provider catalog for OpenAI, Anthropic, Google, OpenRouter, GitHub Copilot, and Ollama
- typed library API
- CLI commands for login and model selection
- file-backed config store
- separate local secret store written with `0600` permissions
- prompt helpers built with `@clack/prompts`

## Install

```bash
npm install ai-auth-kit
```

For local development:

```bash
npm install
npm run build
npm link
```

## CLI

```bash
ai-auth-kit providers
ai-auth-kit login
ai-auth-kit models openai
ai-auth-kit use openai gpt-5-mini
ai-auth-kit current
ai-auth-kit doctor
```

Default storage location:

```text
~/.config/ai-auth-kit/config.json
~/.config/ai-auth-kit/secrets.json
```

`config.json` stores credential references and the selected model. `secrets.json` stores local API keys. Apps can replace the secret store with an OS keychain or their own backend.

## Library Usage

```ts
import { createAuthKit } from "ai-auth-kit";

const kit = createAuthKit({ configDir: ".my-tool" });

await kit.saveEnvCredential("openai", "OPENAI_API_KEY");
await kit.selectModel("openai", "gpt-5-mini");

const selection = await kit.resolveSelection();
const auth = await kit.runtimeAuth("openai");

console.log(selection?.provider.name, selection?.model.name);
console.log(auth.env);
```

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
voxtype-tools model select
voxtype-tools postprocess
```

Then VoxType can call:

```toml
[output.post_process]
command = "voxtype-tools postprocess"
timeout_ms = 30000
```

## Design Choice

OpenCode is a good UX reference, but this package does not depend on OpenCode internals. Provider OAuth adapters can be added later through pi-ai or dedicated CLI adapters.
