import { loginOpenAiAccountInBrowser } from "./account-oauth-browser.js";
import { extractOpenAiAccountId, now, type AccountOAuthDeps, type AccountOAuthLoginPrompts, type OpenAiCodexRefreshToken, type OpenAiTokenResponse, OPENAI_CLIENT_ID, OPENAI_CODEX_BASE_URL, OPENAI_ISSUER, readJson, requireFetch, secretRef, sleep } from "./account-oauth-shared.js";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";

interface DeviceCode { readonly device_auth_id: string; readonly user_code: string; readonly interval?: string; }
interface DeviceAuthorization { readonly authorization_code: string; readonly code_verifier: string; }

export async function refreshOpenAiCodexToken(refreshToken: string): Promise<OpenAiCodexRefreshToken> {
  const response = await requireFetch({})(`${OPENAI_ISSUER}/oauth/token`, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: OPENAI_CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken }) });
  const token = await readJson<OpenAiTokenResponse>(response, "OpenAI token refresh");
  const accountId = extractOpenAiAccountId(token.id_token);
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresInSeconds: token.expires_in ?? 3600, ...(accountId ? { accountId } : {}) };
}

async function pollDeviceAuthorization(deviceAuthId: string, userCode: string, intervalMs: number, deps: AccountOAuthDeps): Promise<DeviceAuthorization> {
  const fetchImpl = requireFetch(deps);
  while (true) {
    await sleep(deps, intervalMs);
    const response = await fetchImpl(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }) });
    if (response.ok) return readJson<DeviceAuthorization>(response, "OpenAI device authorization polling");
    if (response.status !== 403 && response.status !== 404) throw new Error(`OpenAI device login failed: ${response.status} ${await response.text()}`);
  }
}

async function loginWithDeviceCode(prompts: AccountOAuthLoginPrompts, deps: AccountOAuthDeps): Promise<OpenAiTokenResponse> {
  const fetchImpl = requireFetch(deps);
  const device = await readJson<DeviceCode>(await fetchImpl(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }) }), "OpenAI device login start");
  prompts.info(`Open ${OPENAI_ISSUER}/codex/device and enter code: ${device.user_code}`);
  const authorization = await pollDeviceAuthorization(device.device_auth_id, device.user_code, Math.max(Number.parseInt(device.interval ?? "5", 10) || 5, 1) * 1000, deps);
  const response = await fetchImpl(`${OPENAI_ISSUER}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: authorization.authorization_code, redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`, client_id: OPENAI_CLIENT_ID, code_verifier: authorization.code_verifier }).toString() });
  return readJson<OpenAiTokenResponse>(response, "OpenAI token exchange");
}

export async function loginOpenAiAccount(kit: AuthKit, provider: ProviderDefinition, prompts: AccountOAuthLoginPrompts, deps: AccountOAuthDeps = {}): Promise<StoredCredential> {
  let token: OpenAiTokenResponse;
  try { token = await loginOpenAiAccountInBrowser(prompts, deps); }
  catch (error) { prompts.info(`Browser sign-in unavailable. Falling back to device code. ${error instanceof Error ? error.message : String(error)}`); token = await loginWithDeviceCode(prompts, deps); }
  const accessTokenRef = secretRef(provider.id, "access-token");
  const refreshTokenRef = secretRef(provider.id, "refresh-token");
  await kit.secrets.set(accessTokenRef, token.access_token);
  await kit.secrets.set(refreshTokenRef, token.refresh_token);
  const accountId = extractOpenAiAccountId(token.id_token);
  return kit.saveExternalOAuth(provider.id, { adapter: "openai-codex", accessTokenRef, refreshTokenRef, expiresAt: String(now(deps) + (token.expires_in ?? 3600) * 1000), baseUrl: OPENAI_CODEX_BASE_URL, ...(accountId ? { accountId } : {}) });
}
