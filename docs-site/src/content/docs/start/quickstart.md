---
title: 60-second quickstart
description: Install AI Auth Kit from an exact Git commit and verify library or CLI access.
---

## Prerequisites

- Bun 1.3.14 or newer
- A GitHub network connection for the first install

## Step 1 — Add the exact source commit

Scroll the command block sideways to read and copy the complete pinned SHA at any viewport width.

```sh
bun add --ignore-scripts --exact github:abran-labs/ai-auth-kit#adcb364fa086ec1a854d2b412a5efbd530595b98
bun install --ignore-scripts --frozen-lockfile
```

Review the complete commit before changing the SHA. `bun.lock` must record the same commit.

## Step 2 — Choose library or CLI

### Library

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();

for (const provider of kit.listProviders()) {
  console.log(provider.id, provider.authMethods);
}
```

### CLI

```sh
ai-auth-kit init --project my-tool
ai-auth-kit login --project my-tool
ai-auth-kit use --project my-tool
ai-auth-kit current --project my-tool
```

`login` prompts for a provider and supported auth method. `use` prompts for a provider and model.

## Step 3 — Verify storage

```sh
ai-auth-kit path --project my-tool
ai-auth-kit doctor --project my-tool
```

The project path should resolve under `./.ai-auth-kit/my-tool/`. See [Storage and privacy](../../guides/storage-privacy/)
before deciding whether project or global storage is right for your application.

:::caution[Installer status]
Use the Git dependency today. The Linux installer is release-pending and is not the primary
installation path.
:::
