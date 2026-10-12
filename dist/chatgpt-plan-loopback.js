import { createServer } from "node:http";
import { CHATGPT_CALLBACK_PATH, ChatGptPlanError, parseChatGptCallback } from "./chatgpt-plan.js";
const BIND_HOST = "127.0.0.1";
function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function send(response, status, title, body) {
    response.statusCode = status;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></body></html>`);
}
function boundPort(server) {
    const address = server.address();
    if (typeof address === "object" && address !== null && "port" in address) {
        const port = address.port;
        return typeof port === "number" ? port : undefined;
    }
    return undefined;
}
function listen(server, port) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, BIND_HOST, () => { server.off("error", reject); resolve(); });
    });
}
async function closeServer(server) {
    // Browsers leave spare keep-alive connections open; without this close() hangs.
    server.closeAllConnections();
    if (server.listening)
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
export async function startChatGptLoopback(ports, pendingFor) {
    const server = createServer();
    let settled = false;
    let resolveOutcome = () => undefined;
    const outcome = new Promise((resolve) => { resolveOutcome = resolve; });
    server.on("request", (request, response) => {
        const rawUrl = request.url ?? "/";
        if (new URL(rawUrl, "http://127.0.0.1").pathname !== CHATGPT_CALLBACK_PATH) {
            return send(response, 404, "Not found", "This callback path is not used by ai-auth-kit.");
        }
        const pending = pendingFor();
        if (pending === undefined || settled)
            return send(response, 503, "Not ready", "The sign-in session is not ready yet.");
        const port = boundPort(server) ?? 0;
        try {
            const parsed = parseChatGptCallback(`http://${BIND_HOST}:${port}${rawUrl}`, pending);
            settled = true;
            send(response, 200, "ChatGPT plan sign-in complete", "You can return to the terminal.");
            resolveOutcome({ ok: true, code: parsed.code, clientId: parsed.clientId });
        }
        catch (error) {
            if (!(error instanceof ChatGptPlanError))
                return send(response, 400, "Sign-in failed", "The authorization response was invalid.");
            settled = true;
            send(response, 400, "Sign-in failed", error.message);
            resolveOutcome({ ok: false, error });
        }
    });
    let failure;
    for (const port of ports) {
        try {
            await listen(server, port);
            const actual = boundPort(server);
            if (actual === undefined)
                throw new Error("Unable to read ChatGPT localhost callback port");
            return {
                port: actual,
                redirectUri: `http://${BIND_HOST}:${actual}${CHATGPT_CALLBACK_PATH}`,
                waitForCallback: () => outcome,
                close: () => closeServer(server),
            };
        }
        catch (error) {
            failure = error instanceof Error ? error : new Error(String(error));
        }
    }
    await closeServer(server).catch(() => undefined);
    throw failure ?? new Error("Unable to open ChatGPT localhost callback server");
}
//# sourceMappingURL=chatgpt-plan-loopback.js.map