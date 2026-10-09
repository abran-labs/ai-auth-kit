import { z } from "zod";

export const CONNECT_PROTOCOL_VERSION = 1 as const;
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage" as const;

const IdSchema = z.string().min(1).max(256);
export const FlowIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22,128}$/);
const IsoDateSchema = z.iso.datetime();

export const ConnectMethodSchema = z.enum(["api-key", "account"]);

export const ConnectFlowSchema = z.enum(["secret", "chatgpt-plan", "proxy-account"]);

export const ConnectMethodOptionSchema = z.object({
  method: ConnectMethodSchema,
  flow: ConnectFlowSchema,
  label: z.string().min(1),
  hint: z.string().min(1).optional(),
  risk: z.string().min(1).optional(),
}).readonly();

export const ConnectProviderSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  featured: z.boolean(),
  methods: z.array(ConnectMethodOptionSchema).readonly(),
  docsUrl: z.string().min(1).optional(),
}).readonly();

export const ConnectModelSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  contextWindow: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).readonly().optional(),
}).readonly();

export const ConnectUsageSchema = z.object({
  kind: z.literal("chatgpt-plan"),
  manageUrl: z.literal(CHATGPT_USAGE_URL),
}).readonly();

export const ConnectionSchema = z.object({
  providerId: IdSchema,
  providerName: z.string().min(1),
  method: ConnectMethodSchema,
  account: z.string().min(1).optional(),
  health: z.enum(["connected", "reconnect-required"]),
  usage: ConnectUsageSchema.optional(),
  connectedAt: z.string().min(1),
}).readonly();

export const SelectedModelSummarySchema = z.object({
  providerId: IdSchema,
  modelId: IdSchema,
  modelName: z.string().min(1),
}).readonly();

export const ConnectStatusSchema = z.object({
  connections: z.array(ConnectionSchema).readonly(),
  selectedModel: SelectedModelSummarySchema.optional(),
}).readonly();

export const ConnectNoticeSchema = z.literal("remote-revocation-unconfirmed");

export const ConnectStepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("secret-input"),
    flowId: FlowIdSchema,
    providerId: IdSchema,
    label: z.string().min(1),
    placeholder: z.string().min(1).optional(),
  }).readonly(),
  z.object({
    kind: z.literal("confirm-risk"),
    flowId: FlowIdSchema,
    providerId: IdSchema,
    message: z.string().min(1),
  }).readonly(),
  z.object({
    kind: z.literal("redirect-paste"),
    flowId: FlowIdSchema,
    providerId: IdSchema,
    authorizationUrl: z.url(),
    callbackPrefix: z.string().min(1),
    instructions: z.string().min(1),
    expiresAt: IsoDateSchema,
  }).readonly(),
  z.object({
    kind: z.literal("working"),
    flowId: FlowIdSchema,
    providerId: IdSchema,
    message: z.string().min(1),
    pollAfterMs: z.number().int().positive(),
  }).readonly(),
  z.object({
    kind: z.literal("connected"),
    connection: ConnectionSchema,
  }).readonly(),
]);

const SubmitInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("secret"), value: z.string().min(1).max(8192) }).readonly(),
  z.strictObject({ kind: z.literal("redirect-url"), value: z.string().min(1).max(8192) }).readonly(),
  z.strictObject({ kind: z.literal("confirm"), accepted: z.boolean() }).readonly(),
]);

export const ConnectRequestSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("providers") }).readonly(),
  z.strictObject({ op: z.literal("status") }).readonly(),
  z.strictObject({ op: z.literal("start"), providerId: IdSchema, method: ConnectMethodSchema, fresh: z.boolean().optional() }).readonly(),
  z.strictObject({ op: z.literal("submit"), flowId: FlowIdSchema, input: SubmitInputSchema }).readonly(),
  z.strictObject({ op: z.literal("poll"), flowId: FlowIdSchema }).readonly(),
  z.strictObject({ op: z.literal("cancel"), flowId: FlowIdSchema }).readonly(),
  z.strictObject({ op: z.literal("models"), providerId: IdSchema }).readonly(),
  z.strictObject({ op: z.literal("select-model"), providerId: IdSchema, modelId: IdSchema }).readonly(),
  z.strictObject({ op: z.literal("disconnect"), providerId: IdSchema }).readonly(),
]);

export const ConnectErrorCodeSchema = z.enum([
  "invalid_request",
  "unknown_provider",
  "method_unavailable",
  "flow_not_found",
  "flow_expired",
  "callback_invalid",
  "access_denied",
  "plan_not_granted",
  "credential_rejected",
  "account_in_use",
  "identity_mismatch",
  "not_connected",
  "unknown_model",
  "upstream_unavailable",
  "internal",
]);

export const ConnectResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("providers"), providers: z.array(ConnectProviderSchema).readonly() }).readonly(),
  z.object({ kind: z.literal("status"), status: ConnectStatusSchema, notice: ConnectNoticeSchema.optional() }).readonly(),
  z.object({ kind: z.literal("step"), step: ConnectStepSchema }).readonly(),
  z.object({ kind: z.literal("models"), providerId: IdSchema, models: z.array(ConnectModelSchema).readonly() }).readonly(),
  z.object({ kind: z.literal("cancelled") }).readonly(),
  z.object({
    kind: z.literal("error"),
    code: ConnectErrorCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
  }).readonly(),
]);

export type ConnectMethod = z.output<typeof ConnectMethodSchema>;
export type ConnectFlow = z.output<typeof ConnectFlowSchema>;
export type ConnectMethodOption = z.output<typeof ConnectMethodOptionSchema>;
export type ConnectProvider = z.output<typeof ConnectProviderSchema>;
export type ConnectModel = z.output<typeof ConnectModelSchema>;
export type ConnectUsage = z.output<typeof ConnectUsageSchema>;
export type Connection = z.output<typeof ConnectionSchema>;
export type SelectedModelSummary = z.output<typeof SelectedModelSummarySchema>;
export type ConnectStatus = z.output<typeof ConnectStatusSchema>;
export type ConnectNotice = z.output<typeof ConnectNoticeSchema>;
export type ConnectStep = z.output<typeof ConnectStepSchema>;
export type ConnectRequest = z.output<typeof ConnectRequestSchema>;
export type ConnectErrorCode = z.output<typeof ConnectErrorCodeSchema>;
export type ConnectResponse = z.output<typeof ConnectResponseSchema>;

export function parseConnectRequest(input: unknown): ConnectRequest {
  return ConnectRequestSchema.parse(input);
}

export function parseConnectResponse(input: unknown): ConnectResponse {
  return ConnectResponseSchema.parse(input);
}
