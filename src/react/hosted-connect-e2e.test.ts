import { afterEach, expect, test } from "bun:test";
import { resetChatGptSigningKeysForTests } from "../chatgpt-plan-id-token.js";
import {
  callbackWith,
  chatGptNonce,
  ISSUED,
  planTokenReply,
  setupConnectService,
  stepOf,
} from "../connect-service-test-helpers.js";
import type { ProviderDefinition } from "../types.js";
import { connectReducer, initialConnectState, readStepConnection, type ConnectAction } from "./connect-state.js";
import type { ConnectTransport } from "./transport.js";

const TENANT = "tenant-e2e";

afterEach(() => resetChatGptSigningKeysForTests());

const E2E_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [
      { id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] },
      { id: "o3-mini", name: "o3 mini", tags: ["active", "tools"] },
    ],
  },
];

test("Given the hosted service behind the react transport, when api-key and ChatGPT plan flows run through the reducer, then status and selection stay in sync", async () => {
  const { service, pendingFlows, openai } = setupConnectService({ providers: E2E_PROVIDERS });
  try {
    const transport: ConnectTransport = (request) => service.handle(TENANT, request);
    let state = initialConnectState;
    const dispatch = (action: ConnectAction): void => { state = connectReducer(state, action); };

    dispatch({ kind: "load-started" });
    const providersResponse = await transport({ op: "providers" });
    const statusResponse = await transport({ op: "status" });
    if (providersResponse.kind !== "providers" || statusResponse.kind !== "status") throw new Error("Expected providers and status");
    dispatch({ kind: "load-succeeded", providers: providersResponse.providers, status: statusResponse.status });
    expect(state.phase).toBe("idle");
    expect(providersResponse.providers.find((provider) => provider.id === "openai")?.methods.map((option) => option.flow).sort())
      .toEqual(["chatgpt-plan", "secret"]);

    const keyStep = stepOf(await transport({ op: "start", providerId: "openai", method: "api-key" }));
    if (keyStep.kind !== "secret-input") throw new Error("Expected secret-input");
    dispatch({ kind: "step-arrived", step: keyStep });
    expect(state.step?.kind).toBe("secret-input");
    const keyDone = stepOf(await transport({ op: "submit", flowId: keyStep.flowId, input: { kind: "secret", value: "sk-test" } }));
    if (keyDone.kind !== "connected") throw new Error("Expected connected");
    const keyConnection = readStepConnection({ kind: "step", step: keyDone });
    expect(keyConnection).toMatchObject({ providerId: "openai", method: "api-key", health: "connected" });
    dispatch({ kind: "step-arrived", step: keyDone });

    dispatch({ kind: "open-models", providerId: "openai" });
    const modelsResponse = await transport({ op: "models", providerId: "openai" });
    if (modelsResponse.kind !== "models") throw new Error("Expected models");
    dispatch({ kind: "models-arrived", models: modelsResponse.models, providerId: "openai" });
    expect(state.models.map((model) => model.id)).toEqual(["gpt-4o", "o3-mini"]);

    const selectedResponse = await transport({ op: "select-model", providerId: "openai", modelId: "o3-mini" });
    if (selectedResponse.kind !== "status") throw new Error("Expected status");
    dispatch({ kind: "model-selected" });
    expect(selectedResponse.status.selectedModel).toMatchObject({ providerId: "openai", modelId: "o3-mini" });

    const planStep = stepOf(await transport({ op: "start", providerId: "openai", method: "account" }));
    if (planStep.kind !== "redirect-paste") throw new Error("Expected redirect-paste");
    dispatch({ kind: "step-arrived", step: planStep });
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, planStep.flowId, TENANT)));
    const planDone = stepOf(await transport({
      op: "submit",
      flowId: planStep.flowId,
      input: { kind: "redirect-url", value: callbackWith(planStep.authorizationUrl, planStep.callbackPrefix, { code: "authcode", client_id: ISSUED }) },
    }));
    if (planDone.kind !== "connected") throw new Error("Expected connected");
    dispatch({ kind: "step-arrived", step: planDone });
    expect(planDone.connection.usage).toEqual({ kind: "chatgpt-plan", manageUrl: "https://chatgpt.com/settings/usage" });

    const refreshed = await transport({ op: "status" });
    if (refreshed.kind !== "status") throw new Error("Expected status");
    dispatch({ kind: "load-succeeded", providers: providersResponse.providers, status: refreshed.status });
    expect(state.status?.connections[0]).toMatchObject({ providerId: "openai", method: "account", health: "connected" });
    expect(await service.runtime(TENANT)).toMatchObject({ providerId: "openai", wire: "openai-responses", planUsage: { kind: "chatgpt-plan" } });
  } finally {
    service.dispose();
  }
});
