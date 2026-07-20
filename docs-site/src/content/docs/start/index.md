---
title: Start here
description: Choose the AI Auth Kit path that matches your application or workflow.
---

AI Auth Kit is a TypeScript library. Your host application owns commands and user experience while
the kit provides provider catalog, local authentication policy, project storage, and model state.

## Choose your path

- **Building a host workflow?** Start with the [library guide](../guides/library/).
- **Adding host-owned prompts?** Use `loginWithPrompts()` with a `PromptAdapter` from the
  [library API reference](../reference/api/).
- **Helping a coding agent implement it?** Install the separate [agent skill](../guides/agent-skill/).
- **Need a working setup now?** Complete the [Quickstart](./quickstart/).

:::note[Library distribution]
AI Auth Kit is a pure library installed as exact npm version `1.0.0`. It ships no generic
executable or global command surface. Host applications own commands and user experience.
:::

## What the kit owns

1. Provider and model discovery from Models.dev metadata.
2. Reviewed local rules for each authentication method.
3. Project or opt-in global credential storage.
4. A stable selected-model snapshot when the live catalog changes.
5. Optional account-login adapters where local policy allows them.

It does not make model API requests for your application. Call `runtimeAuth(providerId)` and pass the
returned environment or external-auth data to your own provider client.
