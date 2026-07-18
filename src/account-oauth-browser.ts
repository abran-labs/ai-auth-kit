import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildCodeChallenge, type AccountOAuthDeps, type AccountOAuthLoginPrompts, type OpenAiTokenResponse, OPENAI_CLIENT_ID, OPENAI_ISSUER, OPENAI_OAUTH_SCOPES, randomUrlSafeText, readJson, requireFetch } from "./account-oauth-shared.js";

const BIND_HOST = "127.0.0.1";
const REDIRECT_HOST = "localhost";
const CALLBACK_PATH = "/auth/callback";
const CALLBACK_PORTS = [1455, 1457] as const;
const CALLBACK_TIMEOUT_MS = 120_000;
interface Authorization { readonly redirectUri: string; readonly codeVerifier: string; readonly authorizationUrl: string; }
interface LoopbackServer { readonly redirectUri: string; waitForCode(): Promise<string>; close(): Promise<void>; }

function authorizationFor(redirectUri: string, state: string): Authorization {
  const codeVerifier = randomUrlSafeText(48);
  const url = new URL(`${OPENAI_ISSUER}/oauth/authorize`);
  for (const [name, value] of Object.entries({ client_id: OPENAI_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: OPENAI_OAUTH_SCOPES, code_challenge: buildCodeChallenge(codeVerifier), code_challenge_method: "S256", id_token_add_organizations: "true", codex_cli_simplified_flow: "true", state })) url.searchParams.set(name, value);
  return { redirectUri, codeVerifier, authorizationUrl: url.toString() };
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
function listen(server: ReturnType<typeof createServer>, port: number): Promise<void> { return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, BIND_HOST, () => { server.off("error", reject); resolve(); }); }); }
function send(response: ServerResponse<IncomingMessage>, status: number, title: string, body: string): void { response.statusCode = status; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${body}</p></body></html>`); }

async function loopbackServer(state: string, ports: readonly number[]): Promise<LoopbackServer> {
  const server = createServer();
  let settled = false;
  let resolveCode: (code: string) => void = () => undefined;
  let rejectCode: (error: Error) => void = () => undefined;
  const code = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  server.on("request", (request, response) => {
    const url = new URL(request.url ?? "/", `http://${REDIRECT_HOST}`);
    if (url.pathname !== CALLBACK_PATH) return send(response, 404, "Not found", "This callback path is not used by ai-auth-kit.");
    if (url.searchParams.get("state") !== state) return send(response, 400, "State mismatch", "This browser callback did not match the current sign-in session.");
    const error = url.searchParams.get("error");
    if (error) { const description = url.searchParams.get("error_description") ?? error; send(response, 400, "Sign-in failed", description); if (!settled) { settled = true; rejectCode(new Error(`OpenAI browser login failed: ${description}`)); } return; }
    const authorizationCode = url.searchParams.get("code");
    if (!authorizationCode) return send(response, 400, "Missing code", "The authorization response did not include a code.");
    send(response, 200, "OpenAI sign-in complete", "You can return to the terminal.");
    if (!settled) { settled = true; resolveCode(authorizationCode); }
  });
  let failure: Error | undefined;
  for (const port of ports) { try { await listen(server, port); return { redirectUri: `http://${REDIRECT_HOST}:${port}${CALLBACK_PATH}`, waitForCode: () => code, close: async () => { if (server.listening) await closeServer(server); } }; } catch (error) { failure = error instanceof Error ? error : new Error(String(error)); } }
  await closeServer(server).catch(() => undefined);
  throw failure ?? new Error("Unable to open OpenAI localhost callback server");
}

async function openBrowser(url: string, deps: AccountOAuthDeps): Promise<boolean> {
  if (deps.openUrl) return deps.openUrl(url);
  return new Promise((resolve) => { try { const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" }); child.once("error", () => resolve(false)); child.unref(); resolve(true); } catch { resolve(false); } });
}

export async function loginOpenAiAccountInBrowser(prompts: AccountOAuthLoginPrompts, deps: AccountOAuthDeps): Promise<OpenAiTokenResponse> {
  const state = randomUrlSafeText(24);
  const callback = await loopbackServer(state, deps.openAiLoopbackPorts ?? CALLBACK_PORTS);
  const authorization = authorizationFor(callback.redirectUri, state);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const opened = await openBrowser(authorization.authorizationUrl, deps);
    prompts.info(opened ? "OpenAI sign-in opened in your browser. Finish sign-in there, then return here." : `Open this URL to continue OpenAI sign-in: ${authorization.authorizationUrl}`);
    const code = await Promise.race([callback.waitForCode(), new Promise<string>((_, reject) => { timeout = setTimeout(() => reject(new Error("OpenAI browser login timed out waiting for localhost callback")), deps.openAiLoopbackTimeoutMs ?? CALLBACK_TIMEOUT_MS); })]);
    const response = await requireFetch(deps)(`${OPENAI_ISSUER}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: authorization.redirectUri, client_id: OPENAI_CLIENT_ID, code_verifier: authorization.codeVerifier }).toString() });
    return readJson<OpenAiTokenResponse>(response, "OpenAI browser token exchange");
  } finally { if (timeout) clearTimeout(timeout); await callback.close().catch(() => undefined); }
}
