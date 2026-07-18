import { createHash, randomBytes } from "node:crypto";
import type { AuthKit } from "./kit.js";
import type { ProviderDefinition, StoredCredential } from "./types.js";

export const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_ISSUER = "https://auth.openai.com";
export const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const OPENAI_OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", "api.connectors.read", "api.connectors.invoke"].join(" ");
export const GITHUB_COPILOT_CLIENT_ID = "Ov23li8tweQw6odWQebz";
export const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
export const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_COPILOT_API_BASE_URL = "https://api.githubcopilot.com";

export interface AccountOAuthDeps {
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly openUrl?: (url: string) => Promise<boolean>;
  readonly openAiLoopbackTimeoutMs?: number;
  readonly openAiLoopbackPorts?: readonly number[];
}

export interface AccountOAuthLoginPrompts { info(message: string): void; }
export interface OpenAiCodexRefreshToken {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly accountId?: string;
}
export interface OpenAiTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly id_token?: string;
  readonly expires_in?: number;
}
export type AccountLogin = (
  kit: AuthKit,
  provider: ProviderDefinition,
  prompts: AccountOAuthLoginPrompts,
  deps?: AccountOAuthDeps,
) => Promise<StoredCredential>;

export function requireFetch(deps: AccountOAuthDeps): typeof fetch {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is required for account OAuth login");
  return fetchImpl;
}

export async function readJson<T>(response: Response, label: string): Promise<T> {
  const body = await response.text();
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${body}`);
  return JSON.parse(body) as T;
}

export function sleep(deps: AccountOAuthDeps, milliseconds: number): Promise<void> {
  return deps.sleep ? deps.sleep(milliseconds) : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function now(deps: AccountOAuthDeps): number { return deps.now?.() ?? Date.now(); }
export function secretRef(providerId: string, name: string): string { return `provider:${providerId}:oauth:${name}`; }
export function randomUrlSafeText(byteLength: number): string { return randomBytes(byteLength).toString("base64url"); }
export function buildCodeChallenge(codeVerifier: string): string { return createHash("sha256").update(codeVerifier).digest("base64url"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export function extractOpenAiAccountId(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  const [, payload] = idToken.split(".");
  if (!payload) return undefined;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed: unknown = JSON.parse(Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64").toString("utf8"));
    if (!isRecord(parsed)) return undefined;
    const direct = parsed.chatgpt_account_id;
    if (typeof direct === "string") return direct;
    const nested = parsed["https://api.openai.com/auth"];
    if (!isRecord(nested)) return undefined;
    const accountId = nested.chatgpt_account_id;
    return typeof accountId === "string" ? accountId : undefined;
  } catch { return undefined; }
}
