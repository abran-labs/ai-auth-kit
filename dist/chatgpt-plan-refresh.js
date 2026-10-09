import { ChatGptPlanError, refreshChatGptTokens } from "./chatgpt-plan.js";
import { parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
export const CHATGPT_PLAN_REFRESH_WINDOW_MS = 5 * 60_000;
const inFlight = new Map();
function reconnectRequired(credential) {
    return { ...credential, metadata: { ...credential.metadata, health: "reconnect-required" } };
}
async function resolve(context) {
    const metadata = parseChatGptPlanMetadata(context.credential.metadata);
    if (metadata === undefined || metadata.health === "reconnect-required" || metadata.accessTokenRef === undefined || metadata.refreshTokenRef === undefined) {
        return { kind: "reconnect-required", credential: context.credential };
    }
    const now = context.now?.() ?? Date.now();
    const accessToken = await context.secrets.get(metadata.accessTokenRef);
    if (accessToken !== undefined && Number(metadata.expiresAt) > now + CHATGPT_PLAN_REFRESH_WINDOW_MS) {
        return { kind: "ready", accessToken, credential: context.credential };
    }
    const refreshToken = await context.secrets.get(metadata.refreshTokenRef);
    if (refreshToken === undefined) {
        const marked = reconnectRequired(context.credential);
        await context.save(marked);
        return { kind: "reconnect-required", credential: marked };
    }
    try {
        const tokens = await refreshChatGptTokens({ clientId: metadata.clientId, refreshToken, now, ...(context.fetch ? { fetch: context.fetch } : {}) });
        await context.secrets.set(metadata.refreshTokenRef, tokens.refreshToken);
        await context.secrets.set(metadata.accessTokenRef, tokens.accessToken);
        const refreshed = {
            ...context.credential,
            metadata: { ...context.credential.metadata, expiresAt: String(tokens.expiresAt), scopes: tokens.scopes.join(" ") },
        };
        await context.save(refreshed);
        return { kind: "ready", accessToken: tokens.accessToken, credential: refreshed };
    }
    catch (error) {
        if (error instanceof ChatGptPlanError && (error.code === "reconnect_required" || error.code === "invalid_client" || error.code === "plan_not_granted")) {
            const marked = reconnectRequired(context.credential);
            await context.save(marked);
            return { kind: "reconnect-required", credential: marked };
        }
        throw error;
    }
}
export function ensureChatGptPlanAccess(context) {
    const running = inFlight.get(context.key);
    if (running !== undefined)
        return running;
    const next = resolve(context).finally(() => inFlight.delete(context.key));
    inFlight.set(context.key, next);
    return next;
}
//# sourceMappingURL=chatgpt-plan-refresh.js.map