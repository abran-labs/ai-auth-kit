---
title: Use the library
description: Create an AuthKit instance, save credentials, select a model, and resolve runtime auth.
---

Import the package root. Internal source paths are not compatibility surfaces.

## Create a project kit

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();
```

`ready()` refreshes Models.dev metadata when allowed, then falls back to a valid cache or the
bundled snapshot. Call it before presenting current provider and model choices.

## Save authentication

Choose only a method listed by the provider:

```ts
const provider = kit.getProvider("openai");

if (provider.authMethods.includes("env")) {
  await kit.saveEnvCredential(provider.id, "OPENAI_API_KEY");
}
```

Environment credentials store the variable name, not its value. Use `saveApiKey()` when the kit
should own the secret file, or `loginWithPrompts()` for the full interactive flow.

## Select and resolve a model

```ts
const model = kit.listModels("openai")[0];

if (model !== undefined) {
  await kit.selectModel("openai", model.id);
  const selection = await kit.resolveSelection();
  const auth = await kit.runtimeAuth("openai");
  console.log(selection?.model.id, auth.env);
}
```

The selected provider and model are snapshotted. If Models.dev later removes that entry,
`resolveSelection()` can still return the saved historical selection.

## Finish cleanly

Long-running processes may call `startCatalogRefresh()` for hourly refresh attempts. Call
`dispose()` during shutdown to stop the timer.
