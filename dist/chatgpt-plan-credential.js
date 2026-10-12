import { z } from "zod";
import { CHATGPT_PLAN_RESOURCE } from "./chatgpt-plan.js";
export const CHATGPT_PLAN_ADAPTER = "openai-chatgpt-plan";
export const CLIPROXYAPI_ACCOUNT_ADAPTER = "cliproxyapi-account";
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
export function chatGptPlanSecretRefs(providerId) {
    return {
        accessTokenRef: `provider:${providerId}:oauth:access-token`,
        refreshTokenRef: `provider:${providerId}:oauth:refresh-token`,
        idTokenRef: `provider:${providerId}:oauth:id-token`,
    };
}
export function chatGptPlanMetadata(signIn, refs) {
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
export function parseChatGptPlanMetadata(metadata) {
    const parsed = ChatGptPlanMetadataSchema.safeParse(metadata);
    return parsed.success ? parsed.data : undefined;
}
export function chatGptPlanDisabledMetadata(registration) {
    const metadata = {
        adapter: CHATGPT_PLAN_ADAPTER,
        clientId: registration.clientId,
        subject: registration.subject,
        expiresAt: String(registration.now),
        scopes: registration.grantedScopes,
        baseUrl: CHATGPT_PLAN_RESOURCE,
        health: "reconnect-required",
        planUsage: "disabled",
    };
    if (registration.email !== undefined)
        metadata.email = registration.email;
    return metadata;
}
//# sourceMappingURL=chatgpt-plan-credential.js.map