import { z } from "zod";
import { CHATGPT_PLAN_RESOURCE, type ChatGptSignIn } from "./chatgpt-plan.js";

export const CHATGPT_PLAN_ADAPTER = "openai-chatgpt-plan";
export const CLIPROXYAPI_ACCOUNT_ADAPTER = "cliproxyapi-account";

export interface ChatGptPlanSecretRefs {
  readonly accessTokenRef: string;
  readonly refreshTokenRef: string;
  readonly idTokenRef: string;
}

const EpochMsSchema = z.string().regex(/^\d+$/);

export const ChatGptPlanMetadataSchema = z.object({
  adapter: z.literal(CHATGPT_PLAN_ADAPTER),
  clientId: z.string().min(1),
  subject: z.string().min(1),
  email: z.string().min(1).optional(),
  accessTokenRef: z.string().min(1).optional(),
  refreshTokenRef: z.string().min(1).optional(),
  idTokenRef: z.string().min(1).optional(),
  expiresAt: EpochMsSchema,
  scopes: z.string(),
  baseUrl: z.literal(CHATGPT_PLAN_RESOURCE),
  health: z.literal("reconnect-required").optional(),
  planUsage: z.literal("disabled").optional(),
}).readonly();

export type ChatGptPlanMetadata = z.output<typeof ChatGptPlanMetadataSchema>;

export function chatGptPlanSecretRefs(providerId: string): ChatGptPlanSecretRefs {
  return {
    accessTokenRef: `provider:${providerId}:oauth:access-token`,
    refreshTokenRef: `provider:${providerId}:oauth:refresh-token`,
    idTokenRef: `provider:${providerId}:oauth:id-token`,
  };
}

export function chatGptPlanMetadata(signIn: ChatGptSignIn, refs: ChatGptPlanSecretRefs): Readonly<Record<string, string>> {
  return {
    adapter: CHATGPT_PLAN_ADAPTER,
    clientId: signIn.clientId,
    subject: signIn.identity.subject,
    ...(signIn.identity.email === undefined ? {} : { email: signIn.identity.email }),
    ...refs,
    expiresAt: String(signIn.expiresAt),
    scopes: signIn.scopes.join(" "),
    baseUrl: CHATGPT_PLAN_RESOURCE,
  };
}

export function parseChatGptPlanMetadata(metadata: Readonly<Record<string, string>>): ChatGptPlanMetadata | undefined {
  const parsed = ChatGptPlanMetadataSchema.safeParse(metadata);
  return parsed.success ? parsed.data : undefined;
}

export interface ChatGptPlanDisabledRegistration {
  readonly clientId: string;
  readonly subject: string;
  readonly email?: string;
  readonly grantedScopes: string;
  readonly now: number;
}

export function chatGptPlanDisabledMetadata(registration: ChatGptPlanDisabledRegistration): Record<string, string> {
  const metadata: Record<string, string> = {
    adapter: CHATGPT_PLAN_ADAPTER,
    clientId: registration.clientId,
    subject: registration.subject,
    expiresAt: String(registration.now),
    scopes: registration.grantedScopes,
    baseUrl: CHATGPT_PLAN_RESOURCE,
    health: "reconnect-required",
    planUsage: "disabled",
  };
  if (registration.email !== undefined) metadata.email = registration.email;
  return metadata;
}
