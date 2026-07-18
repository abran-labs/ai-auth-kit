import { createHash, randomBytes } from "node:crypto";
export const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_ISSUER = "https://auth.openai.com";
export const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const OPENAI_OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", "api.connectors.read", "api.connectors.invoke"].join(" ");
export const GITHUB_COPILOT_CLIENT_ID = "Ov23li8tweQw6odWQebz";
export const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
export const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_COPILOT_API_BASE_URL = "https://api.githubcopilot.com";
export function requireFetch(deps) {
    const fetchImpl = deps.fetch ?? globalThis.fetch;
    if (!fetchImpl)
        throw new Error("fetch is required for account OAuth login");
    return fetchImpl;
}
export async function readJson(response, label) {
    const body = await response.text();
    if (!response.ok)
        throw new Error(`${label} failed: ${response.status} ${body}`);
    return JSON.parse(body);
}
export function sleep(deps, milliseconds) {
    return deps.sleep ? deps.sleep(milliseconds) : new Promise((resolve) => setTimeout(resolve, milliseconds));
}
export function now(deps) { return deps.now?.() ?? Date.now(); }
export function secretRef(providerId, name) { return `provider:${providerId}:oauth:${name}`; }
export function randomUrlSafeText(byteLength) { return randomBytes(byteLength).toString("base64url"); }
export function buildCodeChallenge(codeVerifier) { return createHash("sha256").update(codeVerifier).digest("base64url"); }
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function extractOpenAiAccountId(idToken) {
    if (!idToken)
        return undefined;
    const [, payload] = idToken.split(".");
    if (!payload)
        return undefined;
    try {
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const parsed = JSON.parse(Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64").toString("utf8"));
        if (!isRecord(parsed))
            return undefined;
        const direct = parsed.chatgpt_account_id;
        if (typeof direct === "string")
            return direct;
        const nested = parsed["https://api.openai.com/auth"];
        if (!isRecord(nested))
            return undefined;
        const accountId = nested.chatgpt_account_id;
        return typeof accountId === "string" ? accountId : undefined;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=account-oauth-shared.js.map