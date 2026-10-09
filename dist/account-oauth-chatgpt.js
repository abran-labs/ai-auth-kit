import { spawn } from "node:child_process";
import { chatGptPlanMetadata, chatGptPlanSecretRefs, parseChatGptPlanMetadata } from "./chatgpt-plan-credential.js";
import { ChatGptPlanError, createChatGptHostId, exchangeChatGptCode, isChatGptHostId, parseChatGptCallback, revokeChatGptSession, startChatGptAuthorization, } from "./chatgpt-plan.js";
import { startChatGptLoopback } from "./chatgpt-plan-loopback.js";
import { CHATGPT_HOST_ID_REF } from "./credential-removal.js";
const DEFAULT_PORTS = [1455, 1457];
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const AGENT_NAME = "ai-auth-kit";
function messageFor(error) {
    switch (error.code) {
        case "access_denied": return "ChatGPT sign-in was declined. No credential was saved.";
        case "plan_not_granted": return "ChatGPT plan usage was not allowed. Sign in again and allow plan usage, or use an API key. No credential was saved.";
        case "invalid_client": return "ChatGPT rejected this app registration. Sign in again. No credential was saved.";
        case "reconnect_required": return "The ChatGPT connection ended. Sign in again. No credential was saved.";
        case "id_token_invalid": return `ChatGPT identity could not be verified. ${error.message} No credential was saved.`;
        case "upstream_unavailable": return `ChatGPT sign-in is unavailable. ${error.message} No credential was saved.`;
        case "callback_invalid": return `${error.message} No credential was saved.`;
    }
}
async function openBrowser(url, deps) {
    if (deps.openUrl)
        return deps.openUrl(url);
    return new Promise((resolve) => {
        try {
            const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
            child.once("error", () => resolve(false));
            child.unref();
            resolve(true);
        }
        catch {
            resolve(false);
        }
    });
}
async function hostIdFor(kit) {
    const stored = await kit.secrets.get(CHATGPT_HOST_ID_REF);
    if (stored !== undefined && isChatGptHostId(stored))
        return stored;
    const created = createChatGptHostId();
    await kit.secrets.set(CHATGPT_HOST_ID_REF, created);
    return created;
}
function pasteFinisher(text) {
    return text({
        message: "Paste the final redirect URL",
        validate: (value) => (value !== undefined && value.trim().length > 0 ? undefined : "Redirect URL is required"),
    }).then((pasted) => {
        if (typeof pasted === "symbol")
            return { kind: "cancelled" };
        return { kind: "pasted", url: pasted };
    }).catch((error) => ({
        kind: "failed",
        error: error instanceof ChatGptPlanError ? error : new ChatGptPlanError("callback_invalid", "The pasted redirect URL could not be used.", { cause: error }),
    }));
}
export async function loginChatGptPlan(kit, provider, prompts, deps = {}) {
    const hostId = await hostIdFor(kit);
    const saved = await kit.getCredential(provider.id);
    const reauth = saved?.type === "oauth-external" ? parseChatGptPlanMetadata(saved.metadata) : undefined;
    let pending;
    const callback = await startChatGptLoopback(deps.chatGptLoopbackPorts ?? DEFAULT_PORTS, () => pending);
    let timer;
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
        const finishers = [
            callback.waitForCallback().then((result) => result.ok
                ? { kind: "callback", code: result.code, clientId: result.clientId }
                : { kind: "failed", error: result.error }),
        ];
        if (prompts.text !== undefined) {
            prompts.info("On a headless or SSH session, paste the final redirect URL below instead.");
            finishers.push(pasteFinisher(prompts.text));
        }
        const winner = await Promise.race([
            ...finishers,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error("ChatGPT plan sign-in timed out waiting for the browser callback (10 minutes).")), deps.chatGptLoopbackTimeoutMs ?? LOGIN_TIMEOUT_MS);
            }),
        ]);
        if (winner.kind === "cancelled") {
            prompts.info("ChatGPT plan sign-in was cancelled. No credential was saved.");
            return undefined;
        }
        if (winner.kind === "failed")
            throw winner.error;
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
        const refs = chatGptPlanSecretRefs(provider.id);
        await kit.secrets.set(refs.accessTokenRef, signIn.accessToken);
        await kit.secrets.set(refs.refreshTokenRef, signIn.refreshToken);
        return kit.saveExternalOAuth(provider.id, chatGptPlanMetadata(signIn, refs));
    }
    catch (error) {
        if (error instanceof ChatGptPlanError)
            prompts.info(messageFor(error));
        throw error;
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
        await callback.close().catch(() => undefined);
    }
}
export async function signOutChatGptPlan(kit, deps = {}) {
    const credential = await kit.getCredential("openai");
    const metadata = credential?.type === "oauth-external" ? parseChatGptPlanMetadata(credential.metadata) : undefined;
    if (metadata === undefined)
        return { remoteRevocationConfirmed: false };
    const refreshToken = metadata.refreshTokenRef === undefined ? undefined : await kit.secrets.get(metadata.refreshTokenRef);
    let confirmed = false;
    if (refreshToken !== undefined) {
        try {
            confirmed = await revokeChatGptSession({
                clientId: metadata.clientId,
                refreshToken,
                ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
            });
        }
        catch {
            confirmed = false;
        }
    }
    if (metadata.accessTokenRef !== undefined)
        await kit.secrets.delete(metadata.accessTokenRef);
    if (metadata.refreshTokenRef !== undefined)
        await kit.secrets.delete(metadata.refreshTokenRef);
    if (metadata.idTokenRef !== undefined)
        await kit.secrets.delete(metadata.idTokenRef);
    // Keep clientId/subject/email so re-login reuses the issued registration; health flags reconnect.
    await kit.saveExternalOAuth("openai", {
        adapter: metadata.adapter,
        clientId: metadata.clientId,
        subject: metadata.subject,
        ...(metadata.email === undefined ? {} : { email: metadata.email }),
        expiresAt: metadata.expiresAt,
        scopes: metadata.scopes,
        baseUrl: metadata.baseUrl,
        health: "reconnect-required",
    });
    return { remoteRevocationConfirmed: confirmed };
}
//# sourceMappingURL=account-oauth-chatgpt.js.map