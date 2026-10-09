import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ChatGptPendingAuthorizationSchema, ChatGptPlanError } from "./chatgpt-plan.js";
import {
  type ConnectErrorCode,
  type ConnectMethod,
  type ConnectModel,
  type ConnectRequest,
  type ConnectResponse,
  type Connection,
} from "./connect-protocol.js";
import type { PendingFlowStore } from "./hosted-store.js";
import type { ProxyAccountConnector, ProxyAccountError } from "./hosted-types.js";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition } from "./types.js";

export const CONNECT_FLOW_TTL_MS = 10 * 60_000;

export const CHATGPT_PASTE_INSTRUCTIONS =
  "Approve access in the browser page that opens. The browser then lands on an address starting with http://127.0.0.1 that fails to load; that failure is expected. Copy the full address from the address bar and paste it here.";

export const PROXY_PASTE_INSTRUCTIONS =
  "Complete the sign-in in the browser page that opens, then paste the full callback address here.";

export class ConnectError extends Error {
  readonly name = "ConnectError";
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function connectErrorResponse(code: ConnectErrorCode, message: string, retryable: boolean): ConnectResponse {
  return { kind: "error", code, message, retryable };
}

export function assertNever(value: never): never {
  throw new ConnectError("internal", "Something went wrong. Try again.", true, { cause: value });
}

export function mapChatGptError(error: ChatGptPlanError): ConnectResponse {
  switch (error.code) {
    case "access_denied":
      return connectErrorResponse("access_denied", error.message, false);
    case "plan_not_granted":
      return connectErrorResponse("plan_not_granted", error.message, false);
    case "callback_invalid":
      return connectErrorResponse("callback_invalid", error.message, false);
    case "id_token_invalid":
      return connectErrorResponse("callback_invalid", "ChatGPT sign-in could not be verified. Start again.", false);
    case "identity_mismatch":
      return connectErrorResponse("identity_mismatch", error.message, false);
    case "invalid_client":
      return connectErrorResponse("upstream_unavailable", "ChatGPT rejected this app registration. Start again.", true);
    case "reconnect_required":
    case "upstream_unavailable":
      return connectErrorResponse("upstream_unavailable", "ChatGPT sign-in is unavailable. Try again.", true);
  }
}

export function mapProxyError(error: ProxyAccountError): ConnectResponse {
  switch (error.code) {
    case "account_in_use":
      return connectErrorResponse("account_in_use", "This account is already in use. Try another account.", false);
    case "flow_expired":
      return connectErrorResponse("flow_expired", "This sign-in expired. Start again.", false);
    case "callback_invalid":
      return connectErrorResponse("callback_invalid", "That address was not recognized. Paste the full callback address.", false);
    case "upstream_unavailable":
      return connectErrorResponse("upstream_unavailable", "The sign-in service is unavailable. Try again.", true);
  }
}

const SecretPendingSchema = z
  .object({ kind: z.literal("secret"), providerId: z.string().min(1), expiresAt: z.number().int().positive() })
  .readonly();

const ChatGptFlowPendingSchema = z
  .object({
    kind: z.literal("chatgpt-plan"),
    providerId: z.literal("openai"),
    authorization: ChatGptPendingAuthorizationSchema,
    expectedSubject: z.string().min(1).optional(),
    expiresAt: z.number().int().positive(),
  })
  .readonly();

const ProxyFlowPendingSchema = z
  .object({
    kind: z.literal("proxy-account"),
    providerId: z.string().min(1),
    stage: z.enum(["risk-confirm", "callback"]),
    session: z.string().min(1).optional(),
    expiresAt: z.number().int().positive(),
  })
  .readonly();

const PendingFlowSchema = z.discriminatedUnion("kind", [SecretPendingSchema, ChatGptFlowPendingSchema, ProxyFlowPendingSchema]);

export type PendingFlow = z.output<typeof PendingFlowSchema>;

export function parsePendingFlow(raw: string): PendingFlow | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const result = PendingFlowSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

export function newFlowId(): string {
  return randomBytes(24).toString("base64url");
}

export interface HostedMethodOffer {
  readonly method: ConnectMethod;
  readonly flow: PendingFlow["kind"];
}

export type ApiKeyVerdict = "valid" | "invalid" | "unknown";

export interface ConnectFlowContext {
  readonly pendingFlows: PendingFlowStore;
  readonly findProvider: (providerId: string) => ProviderDefinition | undefined;
  readonly hostedMethods: (provider: ProviderDefinition) => readonly HostedMethodOffer[];
  readonly kitFor: (tenantId: string) => AuthKit;
  readonly agentName: string;
  readonly hostId: string;
  readonly callbackPort: number;
  readonly proxyAccounts: ProxyAccountConnector | undefined;
  readonly fetch: AuthFetch | undefined;
  readonly now: () => number;
  readonly validateApiKey: ((providerId: string, key: string) => Promise<ApiKeyVerdict>) | undefined;
  readonly readConnection: (tenantId: string, providerId: string) => Promise<Connection | undefined>;
  readonly modelsFor: (tenantId: string, providerId: string) => Promise<readonly ConnectModel[]>;
  readonly ensureDefaultModel: (tenantId: string, providerId: string) => Promise<void>;
}

export type SubmitInput = Extract<ConnectRequest, { op: "submit" }>["input"];

export function flowExpiry(now: number): number {
  return now + CONNECT_FLOW_TTL_MS;
}

export function isoDate(value: number): string {
  return new Date(value).toISOString();
}

export async function loadPending(context: ConnectFlowContext, tenantId: string, flowId: string, remove: boolean): Promise<PendingFlow> {
  const raw = remove ? await context.pendingFlows.take(flowId, tenantId) : await context.pendingFlows.peek(flowId, tenantId);
  const pending = raw === undefined ? undefined : parsePendingFlow(raw);
  if (pending === undefined) {
    await context.pendingFlows.delete(flowId, tenantId);
    throw new ConnectError("flow_not_found", "This sign-in step was not found. Start again.", false);
  }
  if (context.now() >= pending.expiresAt) {
    await context.pendingFlows.delete(flowId, tenantId);
    throw new ConnectError("flow_expired", "This sign-in expired. Start again.", false);
  }
  return pending;
}

export async function connectedStep(context: ConnectFlowContext, tenantId: string, providerId: string): Promise<ConnectResponse> {
  await context.ensureDefaultModel(tenantId, providerId).catch(() => undefined);
  const connection = await context.readConnection(tenantId, providerId);
  if (connection === undefined) throw new ConnectError("internal", "Something went wrong. Try again.", true);
  return { kind: "step", step: { kind: "connected", connection } };
}
