const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
class TransientHttpError extends Error {
    status;
    name = "TransientHttpError";
    constructor(status) {
        super(`Catalog request failed with HTTP ${status}`);
        this.status = status;
    }
}
class CatalogBodyError extends Error {
    name = "CatalogBodyError";
}
function isRetryable(error) {
    return error instanceof TransientHttpError || error instanceof TypeError;
}
async function boundedText(response, maxBytes) {
    const length = response.headers.get("content-length");
    if (length !== null && Number(length) > maxBytes)
        throw new CatalogBodyError("Catalog response limit exceeded");
    const reader = response.body?.getReader();
    if (reader === undefined)
        return "";
    const chunks = [];
    let size = 0;
    while (true) {
        const next = await reader.read();
        if (next.done)
            break;
        size += next.value.byteLength;
        if (size > maxBytes) {
            await reader.cancel();
            throw new CatalogBodyError("Catalog response limit exceeded");
        }
        chunks.push(next.value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(joined);
}
export async function fetchModelsDevCatalog(options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const retries = options.retries ?? 2;
    const signal = AbortSignal.timeout(timeoutMs);
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            if (signal.aborted)
                throw signal.reason;
            const headers = new Headers();
            if (options.etag !== null)
                headers.set("if-none-match", options.etag);
            const response = await options.fetch(options.url, { headers, redirect: "error", signal });
            if (response.status === 304)
                return { kind: "not-modified" };
            if (response.ok)
                return { kind: "fresh", body: await boundedText(response, maxBytes), etag: response.headers.get("etag") };
            if (TRANSIENT_STATUSES.has(response.status))
                throw new TransientHttpError(response.status);
            throw new Error(`Catalog request failed with HTTP ${response.status}`);
        }
        catch (error) {
            if (attempt === retries || signal.aborted || !isRetryable(error))
                throw error;
        }
    }
    throw new Error("Catalog request exhausted retries");
}
//# sourceMappingURL=catalog-http.js.map