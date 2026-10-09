---
title: Hosted multi-tenant mode
description: Connect many tenants to AI providers from a web dashboard with createConnectService.
---

Local mode serves one user on one machine. Hosted mode serves many tenants (for example Discord
guilds) from one server process: each tenant connects its own provider credentials through a web
dashboard, and the host resolves per-tenant runtime auth for inference.

```sh
bun add @abran-labs/ai-auth-kit@1.0.0
```

## Create the service

```ts
import { createConnectService, createMemoryPendingFlowStore, createMemoryTenantStore } from "@abran-labs/ai-auth-kit";

const service = createConnectService({
  tenantStore: createMemoryTenantStore(),
  pendingFlows: createMemoryPendingFlowStore(),
  agentName: "Orbi",
  hostId: "urn:uuid:3f6a5c1e-9b2a-4d1e-8f3a-7c9d2e5b8a01",
  chatGptPlan: { enabled: true },
});

const response = await service.handle("guild-123", { op: "providers" });
const runtime = await service.runtime("guild-123");
service.dispose();
```

`handle()` speaks the browser connect protocol: `providers`, `status`, `start`, `submit`, `poll`,
`cancel`, `models`, `select-model`, `disconnect`. It never throws for expected failures; every
problem comes back as a typed error response the dashboard can render. `runtime()` resolves the
tenant's selected model plus credential into wire details (base URL and headers) for inference.
`reportFailure()` marks connection health from inference errors, for example a 401 becoming
`reconnect-required`. Call `dispose()` at shutdown.

## Implement the storage port for production

The in-memory stores suit tests and simple hosts. Production hosts implement two small ports:

- `HostedTenantStore`: one isolated `AuthKitStorage` per tenant id. Tenant isolation is the host's
  duty: encrypt rows at rest and never mix tenant directories, keys, or prefixes.
- `PendingFlowStore`: short-lived flow state (10-minute TTL) keyed by flow id and tenant id, with
  atomic one-time `take()`. Make it durable across restarts (a database table works) so in-flight
  sign-ins survive deploys.

## Security notes

- API-key auth is offered only for providers with a reviewed base URL table inside the library. A
  remote catalog entry can never add a new endpoint; unknown providers stay unoffered.
- Environment credentials, the legacy Codex flow, and the GitHub Copilot device flow are never
  offered over hosted connect.
- Error responses never echo secrets. Validate pasted keys with `validateApiKey` when the provider
  supports it.
- ChatGPT plan sign-in needs a hosted-app approval from OpenAI before production use:
  [Sign in with ChatGPT interest form](https://openai.com/form/sign-in-with-chatgpt-interest).
- ChatGPT plan UX: after approving, the browser lands on an `http://127.0.0.1` address that fails to
  load. That failure is expected; the user copies the full address-bar URL and pastes it back into
  the dashboard.

See also the [security reference](../../reference/security/).
