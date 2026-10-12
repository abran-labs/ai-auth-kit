import { afterEach, expect, test } from "bun:test";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import {
  callbackWith,
  chatGptNonce,
  errorOf,
  ISSUED,
  planTokenReply,
  setupConnectService,
  startChatGpt,
} from "./connect-service-test-helpers.js";
import { PLAN_SCOPES } from "./connect-service-test-helpers.js";
import { AuthKit } from "./kit.js";
import type { ProviderDefinition } from "./types.js";

afterEach(() => resetChatGptSigningKeysForTests());

const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [{ id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] }],
  },
];

test("Given a saved registration, when reauth returns a different subject, then identity_mismatch is reported and nothing is written", async () => {
  const { service, pendingFlows, openai, tenantStore } = setupConnectService({ providers: PROVIDERS });
  try {
    const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
    await kit.saveExternalOAuth("openai", {
      adapter: "openai-chatgpt-plan",
      clientId: ISSUED,
      subject: "user-sub",
      email: "dev@example.com",
      accessTokenRef: "provider:openai:oauth:access-token",
      refreshTokenRef: "provider:openai:oauth:refresh-token",
      expiresAt: String(Date.now() + 3_600_000),
      scopes: PLAN_SCOPES,
      baseUrl: "https://api.openai.com/v1",
    }, [
      ["provider:openai:oauth:access-token", "old-access"],
      ["provider:openai:oauth:refresh-token", "old-refresh"],
    ]);

    const start = await startChatGpt(service);
    const authorization = new URL(start.authorizationUrl);
    expect(authorization.searchParams.get("client_id")).toBe(ISSUED);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId), PLAN_SCOPES, "other-sub"));

    const response = await service.handle("guild-a", {
      op: "submit",
      flowId: start.flowId,
      input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) },
    });
    expect(errorOf(response)).toBe("identity_mismatch");

    const live = await kit.getCredential("openai");
    if (live?.type !== "oauth-external") throw new Error("Expected the saved credential");
    expect(live.metadata.subject).toBe("user-sub");
    expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("old-access");
    expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("old-refresh");
  } finally {
    service.dispose();
  }
});
