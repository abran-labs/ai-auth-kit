import { spawn } from "node:child_process";
import type * as prompts from "@clack/prompts";
import { chatGptPlanMetadata, chatGptPlanSecretRefs, parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
import {
  ChatGptPlanError,
  createChatGptHostId,
  exchangeChatGptCode,
  isChatGptHostId,
  parseChatGptCallback,
  revokeChatGptSession,
  startChatGptAuthorization,
  type ChatGptPendingAuthorization,
} from "./chatgpt-plan.js";
import { startChatGptLoopback } from "./chatgpt-plan-loopback.js";
import { CHATGPT_HOST_ID_REF } from "./credential-removal.js";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition, StoredCredential } from "./types.js";

export interface ChatGptPlanLoginPrompts {
  readonly info: (message: string) => void;
  readonly text?: typeof prompts.text;
}

export interface ChatGptPlanLoginDeps {
  readonly fetch?: AuthFetch;
  readonly now?: () => number;
  readonly openUrl?: (url: string) => Promise<boolean>;
  readonly agentName?: string;
  readonly chatGptLoopbackPorts?: readonly number[];
  readonly chatGptLoopbackTimeoutMs?: number;
}

export interface ChatGptPlanSignOutResult {
  readonly remoteRevocationConfirmed: boolean;
}

const DEFAULT_PORTS = [1455, 1457] as const;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const AGENT_NAME = "ai-auth-kit";

type Finish =
  | { readonly kind: "callback"; readonly code: string; readonly clientId: string }
  | { readonly kind: "failed"; readonly error: ChatGptPlanError }
  | { readonly kind: "pasted"; readonly url: string }
  | { readonly kind: "cancelled" };

function messageFor(error: ChatGptPlanError): string {
  switch (error.code) {
    case "access_denied": return "ChatGPT sign-in was declined. No credential was saved.";
    case "plan_not_granted": return "ChatGPT plan usage was not allowed. Sign in again and allow plan usage, or use an API key. No credential was saved.";
    case "invalid_client": return "ChatGPT rejected this app registration. Sign in again. No credential was saved.";
    case "reconnect_required": return "The ChatGPT connection ended. Sign in again. No credential was saved.";
    case "id_token_invalid": return `ChatGPT identity could not be verified. ${error.message} No credential was saved.`;
    case "identity_mismatch": return `${error.message} No credential was saved.`;
    case "upstream_unavailable": return `ChatGPT sign-in is unavailable. ${error.message} No credential was saved.`;
    case "callback_invalid": return `${error.message} No credential was saved.`;
  }
}

async function openBrowser(url: string, deps: ChatGptPlanLoginDeps): Promise<boolean> {
  if (deps.openUrl) return deps.openUrl(url);
  return new Promise((resolve) => {
    try {
      const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
      child.once("error", () => resolve(false));
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

async function hostIdFor(kit: AuthKit): Promise<string> {
  const stored = await kit.secrets.get(CHATGPT_HOST_ID_REF);
  if (stored !== undefined && isChatGptHostId(stored)) return stored;
  const created = createChatGptHostId();
  await kit.secrets.set(CHATGPT_HOST_ID_REF, created);
  return created;
}

function pasteFinisher(text: NonNullable<ChatGptPlanLoginPrompts["text"]>): Promise<Finish> {
  return text({
    message: "Paste the final redirect URL",
    validate: (value) => (value !== undefined && value.trim().length > 0 ? undefined : "Redirect URL is required"),
  }).then((pasted): Finish => {
    if (typeof pasted === "symbol") return { kind: "cancelled" };
    return { kind: "pasted", url: pasted };
  }).catch((error: unknown): Finish => ({
    kind: "failed",
    error: error instanceof ChatGptPlanError ? error : new ChatGptPlanError("callback_invalid", "The pasted redirect URL could not be used.", { cause: error }),
  }));
}

export async function loginChatGptPlan(
  kit: AuthKit,
  provider: ProviderDefinition,
  prompts: ChatGptPlanLoginPrompts,
  deps: ChatGptPlanLoginDeps = {},
): Promise<StoredCredential | undefined> {
  const hostId = await hostIdFor(kit);
  const saved = await kit.getCredential(provider.id);
  const reauth = saved?.type === "oauth-external" ? parseChatGptPlanMetadata(saved.metadata) : undefined;
  let pending: ChatGptPendingAuthorization | undefined;
  const callback = await startChatGptLoopback(deps.chatGptLoopbackPorts ?? DEFAULT_PORTS, () => pending);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const authorization = startChatGptAuthorization({
      agentName: deps.agentName ?? AGENT_NAME,
      hostId,
      port: callback.port,
      ...(reauth === undefined ? {} : { clientId: reauth.clientId }),
      ...(reauth?.email === undefined ? {} : { loginHint: reauth.email }),
    });
    pending = authorization.pending;
    const opened = await openBrowser(authorization.authorizationUrl, deps);
    prompts.info(opened
      ? "ChatGPT plan sign-in opened in your browser. Approve plan usage there, then return here."
      : `Open this URL to continue ChatGPT plan sign-in: ${authorization.authorizationUrl}`);
    const finishers: Promise<Finish>[] = [
      callback.waitForCallback().then((result): Finish => result.ok
        ? { kind: "callback", code: result.code, clientId: result.clientId }
        : { kind: "failed", error: result.error }),
    ];
    if (prompts.text !== undefined) {
      prompts.info("On a headless or SSH session, paste the final redirect URL below instead.");
      finishers.push(pasteFinisher(prompts.text));
    }
    const winner = await Promise.race([
      ...finishers,
      new Promise<Finish>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ChatGPT plan sign-in timed out waiting for the browser callback (10 minutes).")), deps.chatGptLoopbackTimeoutMs ?? LOGIN_TIMEOUT_MS);
      }),
    ]);
    if (winner.kind === "cancelled") {
      prompts.info("ChatGPT plan sign-in was cancelled. No credential was saved.");
      return undefined;
    }
    if (winner.kind === "failed") throw winner.error;
    const exchange = winner.kind === "callback"
      ? { code: winner.code, clientId: winner.clientId }
      : parseChatGptCallback(winner.url, authorization.pending);
    const signIn = await exchangeChatGptCode({
      code: exchange.code,
      clientId: exchange.clientId,
      pending: authorization.pending,
      fetch: deps.fetch ?? globalThis.fetch,
      now: deps.now?.() ?? Date.now(),
    });
    if (reauth !== undefined && signIn.identity.subject !== reauth.subject) {
      throw new ChatGptPlanError("identity_mismatch", "This ChatGPT sign-in belongs to a different account than the saved one. Sign in with the saved account, or sign out and start fresh.");
    }
    const refs = chatGptPlanSecretRefs(provider.id);
    return kit.saveExternalOAuth(provider.id, chatGptPlanMetadata(signIn, refs), [
      [refs.accessTokenRef, signIn.accessToken],
      [refs.refreshTokenRef, signIn.refreshToken],
    ]);
  } catch (error) {
    if (error instanceof ChatGptPlanError) prompts.info(messageFor(error));
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    await callback.close().catch(() => undefined);
  }
}

export async function signOutChatGptPlan(kit: AuthKit, deps: { readonly fetch?: AuthFetch } = {}): Promise<ChatGptPlanSignOutResult> {
  const credential = await kit.getCredential("openai");
  const metadata = credential?.type === "oauth-external" ? parseChatGptPlanMetadata(credential.metadata) : undefined;
  if (metadata === undefined) return { remoteRevocationConfirmed: false };
  const refreshToken = metadata.refreshTokenRef === undefined ? undefined : await kit.secrets.get(metadata.refreshTokenRef);
  let confirmed = false;
  if (refreshToken !== undefined) {
    try {
      confirmed = await revokeChatGptSession({
        clientId: metadata.clientId,
        refreshToken,
        ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
      });
    } catch {
      confirmed = false;
    }
  }
  await kit.runExclusive(async () => {
    const live = await kit.store.read();
    const current = live.credentials.openai;
    if (current?.type !== "oauth-external") return;
    const currentMetadata = parseChatGptPlanMetadata(current.metadata);
    if (currentMetadata === undefined) return;
    if (currentMetadata.accessTokenRef !== undefined) await kit.secrets.delete(currentMetadata.accessTokenRef);
    if (currentMetadata.refreshTokenRef !== undefined) await kit.secrets.delete(currentMetadata.refreshTokenRef);
    if (currentMetadata.idTokenRef !== undefined) await kit.secrets.delete(currentMetadata.idTokenRef);
    // Keep clientId/subject/email so re-login reuses the issued registration; health flags reconnect.
    const next: Record<string, string> = {
      adapter: currentMetadata.adapter,
      clientId: currentMetadata.clientId,
      subject: currentMetadata.subject,
      expiresAt: currentMetadata.expiresAt,
      scopes: currentMetadata.scopes,
      baseUrl: currentMetadata.baseUrl,
      health: "reconnect-required",
    };
    if (currentMetadata.email !== undefined) next.email = currentMetadata.email;
    await kit.store.write({
      ...live,
      credentials: { ...live.credentials, openai: { type: "oauth-external", metadata: next, createdAt: current.createdAt } },
      updatedAt: new Date().toISOString(),
    });
  });
  return { remoteRevocationConfirmed: confirmed };
}
