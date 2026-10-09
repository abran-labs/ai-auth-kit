import { afterEach, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resetChatGptSigningKeysForTests } from "./chatgpt-plan-id-token.js";
import {
  callbackWith,
  chatGptNonce,
  ISSUED,
  planTokenReply,
  setupConnectService,
  startChatGpt,
  stepOf,
} from "./connect-service-test-helpers.js";
import { AuthKit } from "./kit.js";
import { DisconnectNotice } from "./react/entity-views.js";
import { connectReducer, initialConnectState } from "./react/connect-state.js";
import type { ProxyAccountBinding, ProxyAccountConnector, ProxyAccountRoute, ProxyAccountTarget } from "./hosted-types.js";
import type { ProviderDefinition } from "./types.js";

afterEach(() => resetChatGptSigningKeysForTests());

const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [{ id: "gpt-4o", name: "GPT-4o", tags: ["active", "tools"] }],
  },
  {
    id: "anthropic", name: "Anthropic", envVars: ["ANTHROPIC_API_KEY"], authMethods: ["api-key", "oauth-external", "env"],
    models: [{ id: "claude-opus", name: "Claude Opus", tags: ["active", "tools"] }],
  },
];

class FailingProxy implements ProxyAccountConnector {
  readonly providerIds: readonly string[] = ["anthropic"];
  warning(): string { return ""; }
  async start(): Promise<never> { throw new Error("not used"); }
  async submitCallback(): Promise<void> { }
  async poll(): Promise<never> { throw new Error("not used"); }
  async cancel(): Promise<void> { }
  async models(): Promise<never> { throw new Error("not used"); }
  async disconnect(_target: ProxyAccountTarget, _binding: ProxyAccountBinding): Promise<void> {
    throw new Error("proxy exploded");
  }
  route(binding: ProxyAccountBinding, modelId: string): ProxyAccountRoute {
    return { baseUrl: binding.routePrefix, headers: {}, model: modelId, wire: "openai-chat" };
  }
}

test("Given a plan disconnect with failed revocation, when handled, then local tokens clear but a notice is returned", async () => {
  const { service, pendingFlows, openai } = setupConnectService({ providers: PROVIDERS });
  try {
    const start = await startChatGpt(service);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
    const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
    if (done.kind !== "connected") throw new Error("Expected connected");

    openai.setReply({ status: 500, body: {} });
    const disconnected = await service.handle("guild-a", { op: "disconnect", providerId: "openai" });
    if (disconnected.kind !== "status") throw new Error("Expected status");
    expect(disconnected.status.connections).toEqual([]);
    expect(disconnected.notice).toBe("remote-revocation-unconfirmed");
  } finally {
    service.dispose();
  }
});

test("Given a plan disconnect with confirmed revocation, when handled, then no notice is returned", async () => {
  const { service, pendingFlows, openai } = setupConnectService({ providers: PROVIDERS });
  try {
    const start = await startChatGpt(service);
    openai.setReply(planTokenReply(await chatGptNonce(pendingFlows, start.flowId)));
    const done = stepOf(await service.handle("guild-a", { op: "submit", flowId: start.flowId, input: { kind: "redirect-url", value: callbackWith(start.authorizationUrl, start.callbackPrefix, { code: "authcode", client_id: ISSUED }) } }));
    if (done.kind !== "connected") throw new Error("Expected connected");

    const disconnected = await service.handle("guild-a", { op: "disconnect", providerId: "openai" });
    if (disconnected.kind !== "status") throw new Error("Expected status");
    expect(disconnected.status.connections).toEqual([]);
    expect("notice" in disconnected).toBe(false);
  } finally {
    service.dispose();
  }
});

test("Given a proxy disconnect that throws, when handled, then the credential is kept and a retryable error is returned", async () => {
  const { service, tenantStore } = setupConnectService({ providers: PROVIDERS, proxyAccounts: new FailingProxy() });
  try {
    const kit = new AuthKit({ storage: tenantStore.storage("guild-a"), providers: PROVIDERS });
    await kit.saveExternalOAuth("anthropic", { adapter: "cliproxyapi-account", credentialName: "cred-1", routePrefix: "http://localhost:8317" });

    const response = await service.handle("guild-a", { op: "disconnect", providerId: "anthropic" });
    if (response.kind !== "error") throw new Error("Expected an error");
    expect(response.code).toBe("upstream_unavailable");
    expect(response.retryable).toBe(true);

    const status = await service.handle("guild-a", { op: "status" });
    if (status.kind !== "status") throw new Error("Expected status");
    expect(status.status.connections.length).toBe(1);
  } finally {
    service.dispose();
  }
});

test("Given a disconnect notice, when reduced, then status updates and the notice shows with a settings link", () => {
  const reduced = connectReducer(initialConnectState, {
    kind: "disconnected",
    status: { connections: [] },
    notice: "remote-revocation-unconfirmed",
  });
  expect(reduced.phase).toBe("idle");
  expect(reduced.status).toEqual({ connections: [] });
  expect(reduced.notice).toBe("remote-revocation-unconfirmed");

  const markup = renderToStaticMarkup(createElement(DisconnectNotice, { notice: "remote-revocation-unconfirmed" }));
  expect(markup).toContain('data-aak-notice="remote-revocation-unconfirmed"');
  expect(markup).toContain("Signed out here.");
  expect(markup).toContain('href="https://chatgpt.com/#settings/Security"');
});
