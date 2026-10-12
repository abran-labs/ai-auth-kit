import { afterEach, expect, test } from "bun:test";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import {
  callbackWith,
  chatGptNonce,
  errorOf,
  ISSUED,
  PLAN_SCOPES,
  planTokenReply,
  setupConnectService,
  startChatGpt,
  stepOf,
} from "./connect-service-test-helpers.js";
import { AuthKit } from "./kit.js";
import type { ProviderDefinition } from "./types.js";

afterEach(() => resetChatGptSigningKeysForTests());

const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [{ id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] }],
  },
];

test("Given a token without the plan scope, when submitted, then plan_not_granted is returned and the registration is kept disabled", async () => {
  const { service, pendingFlows, openai, tenantStore } = setupConnectService({ providers: PROVIDERS });
  try {
    const start = await startChatGpt(service);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId), "openid profile email"));
    const response = await service.handle("guild-a", {
      op: "submit",
      flowId: start.flowId,
      input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) },
    });
    expect(errorOf(response)).toBe("plan_not_granted");

    const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
    const live = await kit.getCredential("openai");
    if (live?.type !== "oauth-external") throw new Error("Expected the disabled registration");
    expect(live.metadata).toMatchObject({
      adapter: "openai-chatgpt-plan",
      clientId: ISSUED,
      subject: "user-sub",
      email: "dev@example.com",
      health: "reconnect-required",
      planUsage: "disabled",
    });
    expect("accessTokenRef" in live.metadata).toBe(false);
    expect("refreshTokenRef" in live.metadata).toBe(false);
    expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
    expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();

    const status = await service.handle("guild-a", { op: "status" });
    if (status.kind !== "status") throw new Error("Expected status");
    expect(status.status.connections[0]).toMatchObject({ providerId: "openai", health: "reconnect-required" });

    const retry = await startChatGpt(service);
    expect(new URL(retry.authorizationUrl).searchParams.get("client_id")).toBe(ISSUED);
  } finally {
    service.dispose();
  }
});

test("Given a refresh that loses the plan scope, when runtime resolves, then the replacement token persists and reconnect is required", async () => {
  const { service, openai, tenantStore } = setupConnectService({ providers: PROVIDERS });
  try {
    const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
    await kit.saveExternalOAuth("openai", {
      adapter: "openai-chatgpt-plan",
      clientId: ISSUED,
      subject: "user-sub",
      accessTokenRef: "provider:openai:oauth:access-token",
      refreshTokenRef: "provider:openai:oauth:refresh-token",
      expiresAt: String(Date.now() - 60_000),
      scopes: PLAN_SCOPES,
      baseUrl: "https://api.openai.com/v1",
    }, [
      ["provider:openai:oauth:access-token", "stale-access"],
      ["provider:openai:oauth:refresh-token", "stale-refresh"],
    ]);
    await kit.selectModel("openai", "gpt-4o");

    openai.setReply({ status: 200, body: { access_token: "at-noscope", refresh_token: "rt-replacement", expires_in: 3600, scope: "openid profile email" } });
    expect(await service.runtime("guild-a")).toBeUndefined();

    expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("rt-replacement");
    const live = await kit.getCredential("openai");
    if (live?.type !== "oauth-external") throw new Error("Expected the marked credential");
    expect(live.metadata).toMatchObject({ health: "reconnect-required", planUsage: "disabled", clientId: ISSUED });
  } finally {
    service.dispose();
  }
});

test("Given a stored id token, when reauth starts, then the authorization URL carries id_token_hint", async () => {
  const { service, pendingFlows, openai } = setupConnectService({ providers: PROVIDERS });
  try {
    const start = await startChatGpt(service);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
    const done = stepOf(await service.handle("guild-a", {
      op: "submit",
      flowId: start.flowId,
      input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) },
    }));
    if (done.kind !== "connected") throw new Error("Expected connected");

    const retry = await startChatGpt(service);
    const hint = new URL(retry.authorizationUrl).searchParams.get("id_token_hint");
    expect(typeof hint).toBe("string");
    expect((hint ?? "").length).toBeGreaterThan(0);
    expect((hint ?? "").split(".").length).toBe(3);
  } finally {
    service.dispose();
  }
});
