import { afterEach, expect, test } from "bun:test";
import { chatGptPlanSecretRefs } from "./chatgpt-plan-credential.js";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import { parsePendingFlow } from "./connect-flow-state.js";
import { type ConnectService } from "./connect-service.js";
import { type HostedTenantStore, type PendingFlowStore } from "./hosted-store.js";
import {
  callbackWith,
  chatGptNonce,
  errorOf,
  fakeOpenAi,
  ISSUED,
  planTokenReply,
  setupConnectService,
  startChatGpt,
  stepOf,
} from "./connect-service-test-helpers.js";
import { AuthKit } from "./kit.js";
import { ProxyAccountError, type ProxyAccountBinding, type ProxyAccountConnector, type ProxyAccountProgress, type ProxyAccountRoute, type ProxyAccountSession, type ProxyAccountStart, type ProxyAccountTarget } from "./hosted-types.js";
import type { ModelDefinition, ProviderDefinition } from "./types.js";

afterEach(() => resetChatGptSigningKeysForTests());

const TEST_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [
      { id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] },
      { id: "gpt-image-1", name: "Image", tags: ["active"] },
      { id: "o3-mini", name: "o3 mini", tags: ["active", "tools"] },
      { id: "text-embedding-3-small", name: "Embedding", tags: ["active"] },
    ],
  },
  {
    id: "anthropic", name: "Anthropic", envVars: ["ANTHROPIC_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [{ id: "claude-opus", name: "Claude Opus", tags: ["active", "tools"] }],
  },
];

class FakeProxyAccounts implements ProxyAccountConnector {
  readonly providerIds: readonly string[] = ["anthropic"];
  private next = 1;
  private readonly sessions = new Map<string, { submitted: boolean; ready: boolean }>();
  readonly cancelled: string[] = [];
  readonly disconnected: { readonly tenantId: string; readonly providerId: string }[] = [];
  submitBehavior: "ok" | "in-use" = "ok";

  warning(): string {
    return "Proxy routing uses an unofficial flow and may violate provider terms. Continue only if you accept that risk.";
  }

  async start(target: ProxyAccountTarget): Promise<ProxyAccountStart> {
    const session = `sess-${this.next++}`;
    this.sessions.set(session, { submitted: false, ready: false });
    return { authorizationUrl: `https://proxy.example/login?session=${session}`, callbackPrefix: "https://proxy.example/callback", session, expiresAt: Date.now() + 600_000 };
  }

  async submitCallback(session: ProxyAccountSession, redirectUrl: string): Promise<void> {
    if (this.submitBehavior === "in-use") throw new ProxyAccountError("account_in_use", "taken");
    const entry = this.sessions.get(session.session);
    if (entry === undefined) throw new ProxyAccountError("flow_expired", "gone");
    if (!redirectUrl.startsWith("https://proxy.example/callback")) throw new ProxyAccountError("callback_invalid", "bad");
    entry.submitted = true;
  }

  async poll(session: ProxyAccountSession): Promise<ProxyAccountProgress> {
    const entry = this.sessions.get(session.session);
    if (entry === undefined) throw new ProxyAccountError("flow_expired", "gone");
    if (!entry.submitted || !entry.ready) return { kind: "pending" };
    return { kind: "connected", binding: { credentialName: "cred-1", routePrefix: "http://localhost:8317", email: "user@example.com" } };
  }

  async cancel(session: ProxyAccountSession): Promise<void> {
    this.sessions.delete(session.session);
    this.cancelled.push(session.session);
  }

  complete(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry !== undefined) entry.ready = true;
  }

  async models(): Promise<readonly ModelDefinition[]> {
    return [{ id: "proxy-claude", name: "Proxy Claude" }];
  }

  async disconnect(target: ProxyAccountTarget): Promise<void> {
    this.disconnected.push({ tenantId: target.tenantId, providerId: target.providerId });
  }

  route(binding: ProxyAccountBinding, modelId: string): ProxyAccountRoute {
    return { baseUrl: binding.routePrefix, headers: { Authorization: "Bearer proxy-token" }, model: modelId, wire: "openai-chat" };
  }
}

function setup(): { readonly service: ConnectService; readonly pendingFlows: PendingFlowStore; readonly openai: ReturnType<typeof fakeOpenAi>; readonly proxy: FakeProxyAccounts; readonly tenantStore: HostedTenantStore } {
  const proxy = new FakeProxyAccounts();
  const base = setupConnectService({ providers: TEST_PROVIDERS, proxyAccounts: proxy });
  return { ...base, proxy };
}

test("Given hosted ChatGPT plan, when the flow completes, then status, models, and runtime reflect the plan", async () => {
  const { service, pendingFlows, openai } = setup();
  const start = await startChatGpt(service);
  expect(start.callbackPrefix).toBe("http://127.0.0.1:1455/auth/callback");
  openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));

  const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
  if (done.kind !== "connected") throw new Error("Expected connected");
  expect(done.connection).toMatchObject({ providerId: "openai", method: "account", account: "dev@example.com", health: "connected", usage: { kind: "chatgpt-plan", manageUrl: "https://chatgpt.com/settings/usage" } });

  const models = await service.handle("guild-a", { op: "models", providerId: "openai" });
  if (models.kind !== "models") throw new Error("Expected models");
  expect(models.models.map((model) => model.id)).toEqual(["gpt-4o", "o3-mini"]);

  const status = await service.handle("guild-a", { op: "status" });
  if (status.kind !== "status") throw new Error("Expected status");
  expect(status.status.selectedModel?.modelId).toBe("gpt-4o");

  expect(await service.runtime("guild-a")).toMatchObject({ providerId: "openai", modelId: "gpt-4o", wire: "openai-responses", baseUrl: "https://api.openai.com/v1", planUsage: { kind: "chatgpt-plan" } });
  service.dispose();
});

test("Given a plan connection, when auth is revoked, then runtime clears and status asks to reconnect", async () => {
  const { service, pendingFlows, openai } = setup();
  const start = await startChatGpt(service);
  openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
  const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
  if (done.kind !== "connected") throw new Error("Expected connected");

  await service.reportFailure("guild-a", { providerId: "openai", kind: "plan_limit" });
  expect((await service.runtime("guild-a"))?.wire).toBe("openai-responses");

  await service.reportFailure("guild-a", { providerId: "openai", kind: "auth_revoked" });
  expect(await service.runtime("guild-a")).toBeUndefined();
  const status = await service.handle("guild-a", { op: "status" });
  if (status.kind !== "status") throw new Error("Expected status");
  expect(status.status.connections[0]?.health).toBe("reconnect-required");
  service.dispose();
});

test("Given ChatGPT callbacks, when consent is declined or scope is missing, then precise codes are returned", async () => {
  const { service, pendingFlows, openai } = setup();
  const denied = await startChatGpt(service);
  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: denied.flowId, input: { kind: "redirect-url", value: callbackWith(denied.authorizationUrl, denied.callbackPrefix, { error: "access_denied" }) } }))).toBe("access_denied");

  const scoped = await startChatGpt(service);
  openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, scoped.flowId), "openid profile email"));
  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: scoped.flowId, input: { kind: "redirect-url", value: callbackWith(scoped.authorizationUrl, scoped.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }))).toBe("plan_not_granted");
  service.dispose();
});

test("Given a plan connection, when disconnected, then the session is revoked and state is cleared", async () => {
  const { service, pendingFlows, openai } = setup();
  const start = await startChatGpt(service);
  openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
  const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
  if (done.kind !== "connected") throw new Error("Expected connected");

  const disconnected = await service.handle("guild-a", { op: "disconnect", providerId: "openai" });
  if (disconnected.kind !== "status") throw new Error("Expected status");
  expect(disconnected.status.connections).toEqual([]);
  expect(openai.urls.some((url) => url.endsWith("/api/accounts/oauth/revoke"))).toBe(true);
  service.dispose();
});

test("Given a plan connection, when state is re-read, then secret reconcile keeps tenant tokens and status plus runtime still work", async () => {
  const { service, pendingFlows, openai, tenantStore } = setup();
  try {
    const start = await startChatGpt(service);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
    const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
    if (done.kind !== "connected") throw new Error("Expected connected");

    const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: TEST_PROVIDERS });
    await kit.readState();
    const refs = chatGptPlanSecretRefs("openai");
    expect(await kit.secrets.get(refs.accessTokenRef)).toBe("plan-at");
    expect(await kit.secrets.get(refs.refreshTokenRef)).toBe("plan-rt");

    const status = await service.handle("guild-a", { op: "status" });
    if (status.kind !== "status") throw new Error("Expected status");
    expect(status.status.connections[0]).toMatchObject({ providerId: "openai", method: "account", health: "connected" });
    expect(await service.runtime("guild-a")).toMatchObject({ providerId: "openai", wire: "openai-responses", planUsage: { kind: "chatgpt-plan" } });
  } finally {
    service.dispose();
  }
});

test("Given a proxy account flow, when risk is declined, then the flow is cancelled", async () => {
  const { service } = setup();
  const providers = await service.handle("guild-a", { op: "providers" });
  if (providers.kind !== "providers") throw new Error("Expected providers");
  const anthropic = providers.providers.find((provider) => provider.id === "anthropic");
  expect(anthropic?.methods).toEqual([
    { method: "api-key", flow: "secret", label: "API key", hint: "Paste a Anthropic API key" },
    { method: "account", flow: "proxy-account", label: "Sign in with Anthropic", risk: "Proxy routing uses an unofficial flow and may violate provider terms. Continue only if you accept that risk." },
  ]);

  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "anthropic", method: "account" }));
  if (started.kind !== "confirm-risk") throw new Error("Expected confirm-risk");
  expect(await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "confirm", accepted: false } })).toEqual({ kind: "cancelled" });
  service.dispose();
});

test("Given a proxy account flow, when accepted and completed, then polling resolves to a routed connection", async () => {
  const { service, pendingFlows, proxy } = setup();
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "anthropic", method: "account" }));
  if (started.kind !== "confirm-risk") throw new Error("Expected confirm-risk");
  const redirect = stepOf(await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "confirm", accepted: true } }));
  if (redirect.kind !== "redirect-paste") throw new Error("Expected redirect-paste");
  expect(redirect.callbackPrefix).toBe("https://proxy.example/callback");

  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: redirect.flowId, input: { kind: "redirect-url", value: "https://evil.example/cb?x=1" } }))).toBe("callback_invalid");
  const working = stepOf(await service.handle("guild-a", { op: "submit", flowId: redirect.flowId, input: { kind: "redirect-url", value: "https://proxy.example/callback?code=1" } }));
  if (working.kind !== "working") throw new Error("Expected working");

  const polling = stepOf(await service.handle("guild-a", { op: "poll", flowId: redirect.flowId }));
  if (polling.kind !== "working") throw new Error("Expected working while pending");

  const raw = await pendingFlows.peek(redirect.flowId, "guild-a");
  const pending = raw === undefined ? undefined : parsePendingFlow(raw);
  if (pending?.kind !== "proxy-account" || pending.session === undefined) throw new Error("Expected a proxy session");
  proxy.complete(pending.session);

  const done = stepOf(await service.handle("guild-a", { op: "poll", flowId: redirect.flowId }));
  if (done.kind !== "connected") throw new Error("Expected connected");
  expect(done.connection).toMatchObject({ providerId: "anthropic", method: "account", account: "user@example.com" });

  const models = await service.handle("guild-a", { op: "models", providerId: "anthropic" });
  if (models.kind !== "models") throw new Error("Expected models");
  expect(models.models.map((model) => model.id)).toEqual(["proxy-claude"]);

  expect(await service.runtime("guild-a")).toMatchObject({ providerId: "anthropic", wire: "openai-chat", baseUrl: "http://localhost:8317", headers: { Authorization: "Bearer proxy-token" } });

  await service.handle("guild-a", { op: "disconnect", providerId: "anthropic" });
  expect(proxy.disconnected).toEqual([{ tenantId: "guild-a", providerId: "anthropic" }]);
  service.dispose();
});

test("Given a proxy flow, when the account is taken or the session ends, then precise codes are returned", async () => {
  const { service, proxy } = setup();
  proxy.submitBehavior = "in-use";
  const started = stepOf(await service.handle("guild-a", { op: "start", providerId: "anthropic", method: "account" }));
  if (started.kind !== "confirm-risk") throw new Error("Expected confirm-risk");
  const redirect = stepOf(await service.handle("guild-a", { op: "submit", flowId: started.flowId, input: { kind: "confirm", accepted: true } }));
  if (redirect.kind !== "redirect-paste") throw new Error("Expected redirect-paste");
  expect(errorOf(await service.handle("guild-a", { op: "submit", flowId: redirect.flowId, input: { kind: "redirect-url", value: "https://proxy.example/callback?code=1" } }))).toBe("account_in_use");

  const cancelled = await service.handle("guild-a", { op: "cancel", flowId: redirect.flowId });
  expect(cancelled).toEqual({ kind: "cancelled" });
  expect(proxy.cancelled.length).toBe(1);
  service.dispose();
});
