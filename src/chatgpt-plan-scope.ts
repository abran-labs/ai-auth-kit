import { z } from "zod";
import { CHATGPT_PLAN_SCOPE, type ChatGptPlanTokens } from "./chatgpt-plan.js";
import { ChatGptPlanError } from "./chatgpt-plan-id-token.js";

export interface ChatGptTokenBody {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly scope: string;
}

const PlanNotGrantedCauseSchema = z.object({
  clientId: z.string().min(1),
  subject: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  grantedScopes: z.string(),
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number(),
    scopes: z.array(z.string()).readonly(),
    clientId: z.string().min(1),
  }).optional(),
}).readonly();

export type ChatGptPlanNotGrantedCause = z.output<typeof PlanNotGrantedCauseSchema>;

export function planNotGrantedCause(error: unknown): ChatGptPlanNotGrantedCause | undefined {
  if (!(error instanceof ChatGptPlanError) || error.code !== "plan_not_granted") return undefined;
  const parsed = PlanNotGrantedCauseSchema.safeParse(error.cause);
  return parsed.success ? parsed.data : undefined;
}

export function splitPlanTokens(body: ChatGptTokenBody, clientId: string, now: number): { readonly tokens: ChatGptPlanTokens; readonly planGranted: boolean; readonly grantedScopes: string } {
  const scopes = body.scope.split(/\s+/).filter(Boolean);
  const tokens: ChatGptPlanTokens = { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000, scopes, clientId };
  return { tokens, planGranted: scopes.includes(CHATGPT_PLAN_SCOPE), grantedScopes: scopes.join(" ") };
}

export function planNotGrantedError(clientId: string, grantedScopes: string, detail: Omit<ChatGptPlanNotGrantedCause, "clientId" | "grantedScopes">): ChatGptPlanError {
  return new ChatGptPlanError("plan_not_granted", "ChatGPT plan usage was not allowed. Sign in again and allow plan usage, or use an API key.", {
    cause: { clientId, grantedScopes, ...detail },
  });
}
