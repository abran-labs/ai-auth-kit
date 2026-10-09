import { refreshOpenAiCodexToken } from "./account-oauth.js";
import { CHATGPT_PLAN_RESOURCE } from "./chatgpt-plan.js";
import { parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
import { ensureChatGptPlanAccess } from "./chatgpt-plan-refresh.js";
import { CHATGPT_USAGE_URL } from "./connect-protocol.js";
const OPENAI_CODEX_REFRESH_WINDOW_MS = 5 * 60_000;
const CHATGPT_PLAN_USAGE = {
    kind: "chatgpt-plan",
    manageUrl: CHATGPT_USAGE_URL,
    requestRules: "responses-store-false-stream-true",
};
function needsRefresh(metadata) {
    const expiresAt = Number(metadata.expiresAt);
    return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + OPENAI_CODEX_REFRESH_WINDOW_MS;
}
async function resolveChatGptPlanAuth(context, credential) {
    const access = await ensureChatGptPlanAccess({
        key: context.secrets.path ?? context.provider.id,
        credential,
        secrets: context.secrets,
        save: context.updateCredential,
    });
    if (access.kind === "reconnect-required") {
        return {
            providerId: context.provider.id,
            credential: access.credential,
            env: {},
            external: { adapter: "openai-chatgpt-plan", headers: {}, health: "reconnect-required", planUsage: CHATGPT_PLAN_USAGE },
        };
    }
    const metadata = parseChatGptPlanMetadata(access.credential.metadata);
    const expiresAt = metadata === undefined ? Number.NaN : Number(metadata.expiresAt);
    return {
        providerId: context.provider.id,
        credential: access.credential,
        env: {},
        external: {
            adapter: "openai-chatgpt-plan",
            accessToken: access.accessToken,
            ...(Number.isFinite(expiresAt) ? { expiresAt } : {}),
            baseUrl: CHATGPT_PLAN_RESOURCE,
            headers: { Authorization: `Bearer ${access.accessToken}` },
            planUsage: CHATGPT_PLAN_USAGE,
        },
    };
}
export async function resolveRuntimeAuth(context) {
    const { credential, provider, secrets } = context;
    const env = {};
    if (credential?.type === "api-key") {
        const value = await secrets.get(credential.secretRef);
        if (value && provider.envVars[0])
            env[provider.envVars[0]] = value;
    }
    if (credential?.type === "env") {
        const value = process.env[credential.envVar];
        if (value)
            env[credential.envVar] = value;
    }
    if (credential?.type !== "oauth-external")
        return { providerId: provider.id, credential, env };
    if (credential.metadata.adapter === "openai-chatgpt-plan") {
        return resolveChatGptPlanAuth(context, credential);
    }
    let runtimeCredential = credential;
    let accessToken = credential.metadata.accessTokenRef ? await secrets.get(credential.metadata.accessTokenRef) : undefined;
    if (credential.metadata.adapter === "openai-codex" && credential.metadata.accessTokenRef && credential.metadata.refreshTokenRef && needsRefresh(credential.metadata)) {
        const refreshToken = await secrets.get(credential.metadata.refreshTokenRef);
        if (refreshToken) {
            const refreshed = await refreshOpenAiCodexToken(refreshToken);
            await secrets.set(credential.metadata.accessTokenRef, refreshed.accessToken);
            await secrets.set(credential.metadata.refreshTokenRef, refreshed.refreshToken);
            runtimeCredential = { ...credential, metadata: { ...credential.metadata, expiresAt: String(Date.now() + refreshed.expiresInSeconds * 1000), ...(refreshed.accountId ? { accountId: refreshed.accountId } : {}) } };
            await context.updateCredential(runtimeCredential);
            accessToken = refreshed.accessToken;
        }
    }
    const headers = {};
    if (accessToken)
        headers.Authorization = `Bearer ${accessToken}`;
    if (runtimeCredential.metadata.accountId)
        headers["ChatGPT-Account-Id"] = runtimeCredential.metadata.accountId;
    return { providerId: provider.id, credential: runtimeCredential, env, external: { adapter: runtimeCredential.metadata.adapter ?? "oauth-external", ...(accessToken ? { accessToken } : {}), ...(runtimeCredential.metadata.expiresAt ? { expiresAt: Number(runtimeCredential.metadata.expiresAt) } : {}), ...(runtimeCredential.metadata.accountId ? { accountId: runtimeCredential.metadata.accountId } : {}), ...(runtimeCredential.metadata.baseUrl ? { baseUrl: runtimeCredential.metadata.baseUrl } : {}), headers } };
}
//# sourceMappingURL=kit-runtime-auth.js.map