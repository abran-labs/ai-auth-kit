import { generateKeyPairSync, sign } from "node:crypto";
import { CHATGPT_PLAN_SCOPE, createChatGptHostId } from "./chatgpt-plan.js";
import { CHATGPT_ISSUER } from "./chatgpt-plan-id-token.js";
import { parsePendingFlow } from "./connect-flow-state.js";
import type { ConnectResponse, ConnectStep } from "./connect-protocol.js";
import { createConnectService, type ConnectService } from "./connect-service.js";
import { createMemoryPendingFlowStore, createMemoryTenantStore, type HostedTenantStore, type PendingFlowStore } from "./hosted-store.js";
import type { ProxyAccountConnector } from "./hosted-types.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";

export const ISSUED = "oaiapp_issued123";
export const PLAN_SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });

export type TokenReply = { readonly status: number; readonly body: unknown };

export function idToken(nonce: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: CHATGPT_ISSUER, sub: "user-sub", aud: ISSUED, exp: nowSeconds + 3600, iat: nowSeconds, nonce, email: "dev@example.com" })).toString("base64url");
  return `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url")}`;
}

export function fakeOpenAi(): { readonly fetch: AuthFetch; readonly urls: string[]; setReply: (reply: TokenReply) => void } {
  const urls: string[] = [];
  let reply: TokenReply = { status: 200, body: {} };
  const fetchImpl: AuthFetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] });
    urls.push(url);
    return Response.json(reply.body, { status: reply.status });
  };
  return { fetch: fetchImpl, urls, setReply: (next) => { reply = next; } };
}

export function stepOf(response: ConnectResponse): ConnectStep {
  if (response.kind !== "step") throw new Error(`Expected a step, got ${response.kind}`);
  return response.step;
}

export function errorOf(response: ConnectResponse): string {
  if (response.kind !== "error") throw new Error(`Expected an error, got ${response.kind}`);
  return response.code;
}

export async function chatGptNonce(pendingFlows: PendingFlowStore, flowId: string, tenantId = "guild-a"): Promise<string> {
  const raw = await pendingFlows.peek(flowId, tenantId);
  const pending = raw === undefined ? undefined : parsePendingFlow(raw);
  if (pending?.kind !== "chatgpt-plan") throw new Error("Expected a ChatGPT pending flow");
  return pending.authorization.nonce;
}

export async function startChatGpt(service: ConnectService, tenantId = "guild-a"): Promise<{ readonly flowId: string; readonly authorizationUrl: string; readonly callbackPrefix: string }> {
  const started = stepOf(await service.handle(tenantId, { op: "start", providerId: "openai", method: "account" }));
  if (started.kind !== "redirect-paste") throw new Error("Expected redirect-paste");
  return { flowId: started.flowId, authorizationUrl: started.authorizationUrl, callbackPrefix: started.callbackPrefix };
}

export function callbackWith(authorizationUrl: string, callbackPrefix: string, params: Record<string, string>): string {
  const state = new URL(authorizationUrl).searchParams.get("state");
  if (state === null) throw new Error("Authorization URL has no state");
  const url = new URL(callbackPrefix);
  url.searchParams.set("state", state);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function planTokenReply(nonce: string, scope: string = PLAN_SCOPES): TokenReply {
  return { status: 200, body: { access_token: "plan-at", refresh_token: "plan-rt", id_token: idToken(nonce), expires_in: 3600, scope } };
}

export function setupConnectService(options: {
  readonly providers: readonly ProviderDefinition[];
  readonly proxyAccounts?: ProxyAccountConnector;
}): { readonly service: ConnectService; readonly pendingFlows: PendingFlowStore; readonly openai: ReturnType<typeof fakeOpenAi>; readonly tenantStore: HostedTenantStore } {
  const pendingFlows = createMemoryPendingFlowStore();
  const openai = fakeOpenAi();
  const tenantStore = createMemoryTenantStore();
  const service = createConnectService({
    tenantStore,
    pendingFlows,
    agentName: "Orbi",
    hostId: createChatGptHostId(),
    providers: options.providers,
    chatGptPlan: { enabled: true },
    ...(options.proxyAccounts === undefined ? {} : { proxyAccounts: options.proxyAccounts }),
    fetch: openai.fetch,
  });
  return { service, pendingFlows, openai, tenantStore };
}
