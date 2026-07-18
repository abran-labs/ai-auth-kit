---
title: Start here
description: Choose the AI Auth Kit path that matches your application or workflow.
---

AI Auth Kit is both a TypeScript library and an interactive command-line tool. Both use the same
provider catalog, local authentication policy, project storage, and model selection state.

## Choose your path

- **Building a CLI or application?** Start with the [library guide](../guides/library/).
- **Configuring a project by hand?** Start with the [CLI guide](../guides/cli/).
- **Need a working setup now?** Complete the [60-second quickstart](./quickstart/).

:::note[Source distribution today]
The project is consumed from Git by an exact commit. It is not published to npm or GitHub
Packages, and public installer release artifacts are still pending.
:::

## What the kit owns

1. Provider and model discovery from Models.dev metadata.
2. Reviewed local rules for each authentication method.
3. Project or opt-in global credential storage.
4. A stable selected-model snapshot when the live catalog changes.
5. Optional account-login adapters where local policy allows them.

It does not make model API requests for your application. Call `runtimeAuth(providerId)` and pass the
returned environment or external-auth data to your own provider client.
