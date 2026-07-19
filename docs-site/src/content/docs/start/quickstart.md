---
title: 60-second quickstart
description: Install exact AI Auth Kit 1.0.0 and verify root library access.
---

## Prerequisites

- Bun 1.3.14 or newer
- A TypeScript Bun or Node ESM host application

*Scroll command blocks sideways when their full contents extend past the reading column.*

## Step 1 — Add exact version 1.0.0

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

Commit the resulting `bun.lock`. Use `bun install --frozen-lockfile` in CI so direct and transitive
versions remain reproducible.

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
privacy](../guides/storage-privacy/) before deciding whether project or global storage fits your
application.

## Agent implementation knowledge

The separate [AI Auth Kit agent skill](../guides/agent-skill/) gives Claude Code, OpenCode, or Codex
version-matched API, auth-flow, host-pattern, and security knowledge. The package runs in your app;
the skill helps the agent implement it correctly. Neither installs the other. For agent work,
bundled skill references are primary knowledge.
Docs are fallback only when those local references do not answer a question.
