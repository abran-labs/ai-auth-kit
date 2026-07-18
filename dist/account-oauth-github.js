import { now, GITHUB_ACCESS_TOKEN_URL, GITHUB_COPILOT_API_BASE_URL, GITHUB_COPILOT_CLIENT_ID, GITHUB_DEVICE_CODE_URL, readJson, requireFetch, secretRef, sleep } from "./account-oauth-shared.js";
async function pollAccessToken(deviceCode, intervalSeconds, expiresInSeconds, deps) {
    const fetchImpl = requireFetch(deps);
    const expiresAt = now(deps) + expiresInSeconds * 1000;
    let interval = intervalSeconds;
    while (now(deps) < expiresAt) {
        await sleep(deps, interval * 1000);
        const token = await readJson(await fetchImpl(GITHUB_ACCESS_TOKEN_URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: GITHUB_COPILOT_CLIENT_ID, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }) }), "GitHub device token polling");
        if (token.access_token)
            return token;
        if (token.error === "authorization_pending")
            continue;
        if (token.error === "slow_down") {
            interval += 5;
            continue;
        }
        throw new Error(token.error_description ?? token.error ?? "GitHub device login failed");
    }
    throw new Error("GitHub device login expired before authorization completed");
}
export async function loginGitHubCopilotAccount(kit, provider, prompts, deps = {}) {
    const fetchImpl = requireFetch(deps);
    const device = await readJson(await fetchImpl(GITHUB_DEVICE_CODE_URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: GITHUB_COPILOT_CLIENT_ID, scope: "read:user" }) }), "GitHub device login start");
    prompts.info(`Open ${device.verification_uri} and enter code: ${device.user_code}`);
    const token = await pollAccessToken(device.device_code, device.interval ?? 5, device.expires_in, deps);
    const accessTokenRef = secretRef(provider.id, "github-token");
    await kit.secrets.set(accessTokenRef, token.access_token ?? "");
    return kit.saveExternalOAuth(provider.id, { adapter: "github-copilot-device", accessTokenRef, baseUrl: GITHUB_COPILOT_API_BASE_URL });
}
//# sourceMappingURL=account-oauth-github.js.map