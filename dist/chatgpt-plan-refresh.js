import { ChatGptPlanError, planNotGrantedCause, refreshChatGptTokens } from "./chatgpt-plan.js";
import { parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
export const CHATGPT_PLAN_REFRESH_WINDOW_MS = 5 * 60_000;
const inFlight = new WeakMap();
export function isSameChatGptGeneration(left, right) {
    return left.createdAt === right.createdAt
        && left.metadata.clientId === right.metadata.clientId
        && left.metadata.subject === right.metadata.subject;
}
function reconnectRequired(credential) {
    return { ...credential, metadata: { ...credential.metadata, health: "reconnect-required" } };
}
async function resolve(context) {
    const current = (await context.readCurrent?.()) ?? context.credential;
    const metadata = parseChatGptPlanMetadata(current.metadata);
    if (metadata === undefined || metadata.health === "reconnect-required" || metadata.accessTokenRef === undefined || metadata.refreshTokenRef === undefined) {
        return { kind: "reconnect-required", credential: current };
    }
    const now = context.now?.() ?? Date.now();
    const accessToken = await context.secrets.get(metadata.accessTokenRef);
    if (accessToken !== undefined && Number(metadata.expiresAt) > now + CHATGPT_PLAN_REFRESH_WINDOW_MS) {
        return { kind: "ready", accessToken, credential: current };
    }
    const refreshToken = await context.secrets.get(metadata.refreshTokenRef);
    if (refreshToken === undefined) {
        const marked = reconnectRequired(current);
        await context.save(marked);
        return { kind: "reconnect-required", credential: marked };
    }
    try {
        const tokens = await refreshChatGptTokens({ clientId: metadata.clientId, refreshToken, now, ...(context.fetch ? { fetch: context.fetch } : {}) });
        const refreshed = {
            ...current,
            metadata: { ...current.metadata, expiresAt: String(tokens.expiresAt), scopes: tokens.scopes.join(" ") },
        };
        await context.save(refreshed, {
            accessTokenRef: metadata.accessTokenRef,
            accessToken: tokens.accessToken,
            refreshTokenRef: metadata.refreshTokenRef,
            refreshToken: tokens.refreshToken,
        });
        return { kind: "ready", accessToken: tokens.accessToken, credential: refreshed };
    }
    catch (error) {
        if (error instanceof ChatGptPlanError && (error.code === "reconnect_required" || error.code === "invalid_client")) {
            const marked = reconnectRequired(current);
            await context.save(marked);
            return { kind: "reconnect-required", credential: marked };
        }
        if (error instanceof ChatGptPlanError && error.code === "plan_not_granted") {
            const declined = planNotGrantedCause(error);
            const marked = {
                ...current,
                metadata: { ...current.metadata, health: "reconnect-required", planUsage: "disabled" },
            };
            if (declined?.tokens === undefined) {
                await context.save(marked);
            }
            else {
                await context.save(marked, {
                    accessTokenRef: metadata.accessTokenRef,
                    accessToken: declined.tokens.accessToken,
                    refreshTokenRef: metadata.refreshTokenRef,
                    refreshToken: declined.tokens.refreshToken,
                });
            }
            return { kind: "reconnect-required", credential: marked };
        }
        throw error;
    }
}
export function ensureChatGptPlanAccess(context) {
    const existing = inFlight.get(context.secrets);
    const table = existing ?? new Map();
    if (existing === undefined)
        inFlight.set(context.secrets, table);
    const running = table.get(context.key);
    if (running !== undefined)
        return running;
    const run = () => resolve(context).finally(() => {
        if (table.get(context.key) === next)
            table.delete(context.key);
    });
    const next = context.lock === undefined ? run() : context.lock(context.key, run);
    table.set(context.key, next);
    return next;
}
//# sourceMappingURL=chatgpt-plan-refresh.js.map