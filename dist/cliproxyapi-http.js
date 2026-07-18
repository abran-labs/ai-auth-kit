const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 15_000;
export class CliProxyTransportError extends Error {
}
function failure(message) { return new Error(`CLIProxyAPI provisioning failed: ${message}`); }
function transportFailure(message) { return new CliProxyTransportError(`CLIProxyAPI provisioning failed: ${message}`); }
function validUrl(url) { return url.protocol === "https:" && url.port === "" && !url.username && !url.password && !url.hash; }
function isCdn(url) { return url.hostname === "objects.githubusercontent.com" || url.hostname === "github-releases.githubusercontent.com" || url.hostname === "release-assets.githubusercontent.com"; }
async function beforeDeadline(promise, controller, deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
        throw failure("request deadline exceeded");
    let timer;
    try {
        return await Promise.race([promise, new Promise((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(transportFailure("request deadline exceeded")); }, remaining); })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
export async function boundedRequest(fetchImpl, start, maximum, api, options = {}) {
    const deadline = options.deadline ?? Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let url = new URL(start);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        if (!validUrl(url))
            throw failure("unsafe request URL");
        if (api && url.href !== "https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest")
            throw failure("unsafe release API URL");
        const controller = new AbortController();
        let response;
        try {
            response = await beforeDeadline(fetchImpl(url.href, { headers: { Accept: "application/vnd.github+json", "User-Agent": "ai-auth-kit" }, redirect: "manual", signal: controller.signal }), controller, deadline);
        }
        catch (error) {
            if (error instanceof CliProxyTransportError)
                throw error;
            throw transportFailure(error instanceof Error ? error.message : "network failure");
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || api || redirects === MAX_REDIRECTS) {
                await response.body?.cancel();
                throw failure("unsafe redirect");
            }
            url = new URL(location, url);
            if (!validUrl(url) || !isCdn(url)) {
                await response.body?.cancel();
                throw failure("unsafe redirect");
            }
            continue;
        }
        if (!response.ok) {
            await response.body?.cancel();
            if (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500)
                throw transportFailure(`request failed with ${response.status} ${response.statusText}`);
            throw failure(`request failed with ${response.status} ${response.statusText}`);
        }
        const declared = response.headers.get("content-length");
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
            await response.body?.cancel();
            throw failure("response exceeds size limit");
        }
        if (!response.body)
            return new Uint8Array();
        const reader = response.body.getReader();
        const chunks = [];
        let total = 0;
        try {
            for (;;) {
                const current = await beforeDeadline(reader.read(), controller, deadline);
                if (current.done)
                    break;
                total += current.value.byteLength;
                if (total > maximum)
                    throw failure("response exceeds size limit");
                chunks.push(current.value);
            }
        }
        catch (error) {
            await reader.cancel();
            throw error;
        }
        finally {
            reader.releaseLock();
        }
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return result;
    }
    throw failure("unsafe redirect");
}
//# sourceMappingURL=cliproxyapi-http.js.map