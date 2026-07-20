---
title: Quickstart
description: Prepare the exact AI Auth Kit 1.0.0 command and verify root library access after publication.
---

## Prerequisites

- Bun 1.3.14 or newer
- A TypeScript Bun or Node ESM host application

*Scroll command blocks sideways when their full contents extend past the reading column.*

## Step 1 — Add exact version 1.0.0

Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.0.0 is published.

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

After publication, commit the resulting `bun.lock`. Use `bun install --frozen-lockfile` in CI so
direct and transitive versions remain reproducible.

## Step 2 — Use the root library

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();

for (const provider of kit.listProviders()) {
  console.log(provider.id, provider.authMethods);
}
```

AI Auth Kit provides runtime APIs only. Your host owns command names, routing, prompts, output, and
provider-client calls.

## Step 3 — Verify storage

`createProjectAuthKit("my-tool")` stores state below `./.ai-auth-kit/my-tool/`. See [Storage and
privacy](../../guides/storage-privacy/) before deciding whether project or global storage fits your
application.

## Next steps

- Build a host workflow with the [library guide](../../guides/library/).
- Choose a supported method in [Providers and authentication](../../guides/providers-auth/).
- Give a coding agent version-matched implementation knowledge with the separate [agent
  skill](../../guides/agent-skill/).
