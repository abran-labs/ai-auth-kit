import { z } from "zod";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { ChatGptPlanError } from "./chatgpt-plan-id-token.js";
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
export function planNotGrantedCause(error) {
    if (!(error instanceof ChatGptPlanError) || error.code !== "plan_not_granted")
        return undefined;
    const parsed = PlanNotGrantedCauseSchema.safeParse(error.cause);
    return parsed.success ? parsed.data : undefined;
}
export function splitPlanTokens(body, clientId, now) {
    const scopes = body.scope.split(/\s+/).filter(Boolean);
    const tokens = { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000, scopes, clientId };
    return { tokens, planGranted: scopes.includes(CHATGPT_PLAN_SCOPE), grantedScopes: scopes.join(" ") };
}
export function planNotGrantedError(clientId, grantedScopes, detail) {
    return new ChatGptPlanError("plan_not_granted", "ChatGPT plan usage was not allowed. Sign in again and allow plan usage, or use an API key.", {
        cause: { clientId, grantedScopes, ...detail },
    });
}
//# sourceMappingURL=chatgpt-plan-scope.js.map