# Host-owned integration patterns — 1.0.0

AI Auth Kit owns auth/model mechanics. Host owns command names, arguments, output, prompts,
cancellation, telemetry, and provider API calls.

## Minimal project integration

```ts
import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";

const kit = createProjectAuthKit("my-tool");
await kit.ready();

const provider = kit.getProvider("openai");
if (provider.authMethods.includes("env")) {
  await kit.saveEnvCredential(provider.id, "OPENAI_API_KEY");
}

const model = kit.listModels(provider.id)[0];
if (model !== undefined) {
  await kit.selectModel(provider.id, model.id);
}

const selection = await kit.resolveSelection();
const auth = await kit.runtimeAuth(provider.id);
console.log(selection?.model.id, Object.keys(auth.env));
```

Do not log secret values, token-bearing headers, or full runtime auth.

## Host command handler

Names below belong to host application, not package:

```ts
import { createProjectAuthKit, loginWithPrompts } from "@abran-labs/ai-auth-kit";

export async function configureHostAuthentication(): Promise<void> {
  const kit = createProjectAuthKit("my-host");
  const credential = await loginWithPrompts(kit);
  if (credential === undefined) return;

  const provider = await kit.getSelectedModel();
  console.log(provider === undefined ? "Authentication saved" : "Authentication updated");
}
```

Wire this function to existing host router/framework. Do not create package-global command names.

## Custom `PromptAdapter`

Use this when host already owns prompt UI:

```ts
import * as prompts from "@clack/prompts";
import {
  createProjectAuthKit,
  loginWithPrompts,
  type PromptAdapter,
} from "@abran-labs/ai-auth-kit";

const promptAdapter: PromptAdapter = {
  isCancel: prompts.isCancel,
  autocomplete: prompts.autocomplete,
  select: prompts.select,
  confirm: prompts.confirm,
  password: prompts.password,
  info: (message) => hostLogger.info(message),
};

const kit = createProjectAuthKit("my-host");
const credential = await loginWithPrompts(kit, undefined, promptAdapter);
if (credential === undefined) hostLogger.info("Authentication unchanged");
```

Never wrap cancellation into an error that causes partial state. The library returns `undefined`
for normal cancellation/decline.

## Explicit storage

```ts
import { createAuthKit, globalStorage } from "@abran-labs/ai-auth-kit";

const kit = createAuthKit({ storage: globalStorage("my-host") });
await kit.ready();
```

Global storage is opt-in. Prefer project storage unless host requirements explicitly need shared
state.

## Provider client handoff

```ts
const selection = await kit.resolveSelection();
if (selection === undefined) throw new Error("Select a model before sending requests");

const runtime = await kit.runtimeAuth(selection.provider.id);
const requestConfiguration = {
  model: selection.model.id,
  env: runtime.env,
  baseUrl: runtime.external?.baseUrl,
  headers: runtime.external?.headers ?? {},
};
```

Pass scoped values to host provider client. AI Auth Kit does not send model requests.

## Verification

- Simulate prompt cancellation and warning decline; assert state unchanged.
- Exercise one exact provider/method supported by local policy.
- Resolve selection after catalog entry removal using saved snapshot fixture.
- Ensure logs contain identifiers/status only, never secrets or runtime headers.
- Call `dispose()` when host started catalog refresh.
