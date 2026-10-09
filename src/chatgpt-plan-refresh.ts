import { ChatGptPlanError, refreshChatGptTokens } from "./chatgpt-plan.js";
import { parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
import type { AuthFetch, ExternalOAuthCredential, SecretStore } from "./types.js";

export const CHATGPT_PLAN_REFRESH_WINDOW_MS = 5 * 60_000;

export interface ChatGptPlanTokenWrite {
  readonly accessTokenRef: string;
  readonly accessToken: string;
  readonly refreshTokenRef: string;
  readonly refreshToken: string;
}

export type ChatGptPlanLock = <T>(key: string, run: () => Promise<T>) => Promise<T>;

export interface ChatGptPlanRefreshContext {
  readonly key: string;
  readonly credential: ExternalOAuthCredential;
  readonly secrets: SecretStore;
  readonly save: (credential: ExternalOAuthCredential, tokens?: ChatGptPlanTokenWrite) => Promise<void>;
  readonly readCurrent?: () => Promise<ExternalOAuthCredential | undefined>;
  readonly lock?: ChatGptPlanLock;
  readonly fetch?: AuthFetch;
  readonly now?: () => number;
}

export type ChatGptPlanAccess =
  | { readonly kind: "ready"; readonly accessToken: string; readonly credential: ExternalOAuthCredential }
  | { readonly kind: "reconnect-required"; readonly credential: ExternalOAuthCredential };

const inFlight = new WeakMap<SecretStore, Map<string, Promise<ChatGptPlanAccess>>>();

export function isSameChatGptGeneration(left: ExternalOAuthCredential, right: ExternalOAuthCredential): boolean {
  return left.createdAt === right.createdAt
    && left.metadata.clientId === right.metadata.clientId
    && left.metadata.subject === right.metadata.subject;
}

function reconnectRequired(credential: ExternalOAuthCredential): ExternalOAuthCredential {
  return { ...credential, metadata: { ...credential.metadata, health: "reconnect-required" } };
}

async function resolve(context: ChatGptPlanRefreshContext): Promise<ChatGptPlanAccess> {
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
    const refreshed: ExternalOAuthCredential = {
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
  } catch (error) {
    if (error instanceof ChatGptPlanError && (error.code === "reconnect_required" || error.code === "invalid_client" || error.code === "plan_not_granted")) {
      const marked = reconnectRequired(current);
      await context.save(marked);
      return { kind: "reconnect-required", credential: marked };
    }
    throw error;
  }
}

export function ensureChatGptPlanAccess(context: ChatGptPlanRefreshContext): Promise<ChatGptPlanAccess> {
  const existing = inFlight.get(context.secrets);
  const table = existing ?? new Map<string, Promise<ChatGptPlanAccess>>();
  if (existing === undefined) inFlight.set(context.secrets, table);
  const running = table.get(context.key);
  if (running !== undefined) return running;
  const run = (): Promise<ChatGptPlanAccess> => resolve(context).finally(() => {
    if (table.get(context.key) === next) table.delete(context.key);
  });
  const next = context.lock === undefined ? run() : context.lock(context.key, run);
  table.set(context.key, next);
  return next;
}
