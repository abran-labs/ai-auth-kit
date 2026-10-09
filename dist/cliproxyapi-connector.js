import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CliProxyManagementError, createCliProxyManagementClient } from "./cliproxyapi-management.js";
import { ProxyAccountError } from "./hosted-types.js";
export const CLIPROXY_CALLBACK_PREFIX = "http://localhost:54545/callback";
const SESSION_TTL_MS = 5 * 60 * 1000;
const LOGIN_SLOT_KEY = "cliproxy:claude-login";
const TIMESTAMP_SKEW_MS = 60 * 1000;
const KIT_TO_PROXY_PROVIDER = { anthropic: "claude" };
export function createMemoryLoginSlot(now = Date.now) {
    const holders = new Map();
    return {
        acquire: async (key, owner, ttlMs) => {
            const current = holders.get(key);
            if (current !== undefined && current.owner !== owner && current.expiresAt > now())
                return false;
            holders.set(key, { owner, expiresAt: now() + ttlMs });
            return true;
        },
        release: async (key, owner) => {
            if (holders.get(key)?.owner === owner)
                holders.delete(key);
        },
    };
}
let sharedSlot;
function sharedLoginSlot() {
    if (sharedSlot === undefined)
        sharedSlot = createMemoryLoginSlot();
    return sharedSlot;
}
const ProviderSchema = z.enum(["anthropic"]);
const FunctionSchema = z.custom((value) => typeof value === "function");
const FetchSchema = z.custom((value) => typeof value === "function");
const NowSchema = z.custom((value) => typeof value === "function");
const SlotSchema = z.custom((value) => typeof value === "object" && value !== null);
const OptionsSchema = z.object({ baseUrl: z.string().min(1).max(2048), managementKey: z.string().min(1).max(4096), clientApiKey: z.string().min(1).max(4096), providers: z.array(ProviderSchema).readonly().optional(), routePrefix: FunctionSchema.optional(), fetch: FetchSchema.optional(), now: NowSchema.optional(), sessionSecret: z.string().min(1).max(4096).optional(), loginSlot: SlotSchema.optional() }).readonly();
const SessionSchema = z.object({ v: z.literal(2), state: z.string().min(1).max(256), names: z.array(z.string().max(1024)).readonly(), tenantId: z.string().min(1).max(256), providerId: z.string().min(1).max(256), startedAt: z.number().int().nonnegative(), slotOwner: z.string().min(1).max(256) }).readonly();
const TargetSchema = z.object({ tenantId: z.string().min(1).max(256), providerId: z.string().min(1).max(256) }).readonly();
const BindingSchema = z.object({ credentialName: z.string().min(1).max(1024), routePrefix: z.string().min(1).max(64), email: z.string().max(1024).optional() }).readonly();
export function defaultCliProxyRoutePrefix(tenantId) {
    return `t${createHash("sha256").update(tenantId, "utf8").digest("hex").slice(0, 16)}`;
}
export function getCliProxyHostedWarning(providerId) {
    const product = providerId === "anthropic" ? "Claude" : providerId;
    return `${product} account login through the hosted proxy uses unofficial account-routing flows. It may violate provider terms and can get your account blocked or limited. Your account will only ever serve requests for your own workspace. Continue only if you accept that risk.`;
}
function toProxyProvider(providerId) {
    const provider = KIT_TO_PROXY_PROVIDER[providerId];
    if (provider === undefined)
        throw new ProxyAccountError("upstream_unavailable", `CLIProxyAPI account login is unsupported for provider ${providerId}`);
    return provider;
}
function validPrefix(prefix) {
    return prefix !== "" && !prefix.includes("/") && /^[A-Za-z0-9_-]+$/.test(prefix);
}
function signSession(secret, data) {
    const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
    return `v2.${payload}.${createHmac("sha256", secret).update(payload, "utf8").digest("base64url")}`;
}
function verifySession(secret, session) {
    const invalid = new ProxyAccountError("flow_expired", "CLIProxyAPI account flow expired or is unknown");
    const parts = session.split(".");
    if (parts.length !== 3 || parts[0] !== "v2" || parts[1] === undefined || parts[2] === undefined)
        throw invalid;
    const expected = createHmac("sha256", secret).update(parts[1], "utf8").digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        throw invalid;
    try {
        return SessionSchema.parse(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
    }
    catch {
        throw invalid;
    }
}
function requireTarget(data, target) {
    if (data.tenantId !== target.tenantId || data.providerId !== target.providerId)
        throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account session does not belong to this workspace");
}
function freshEnough(file, startedAt) {
    const stamps = [file.createdAt, file.updatedAt]
        .filter((stamp) => stamp !== undefined)
        .map((stamp) => Date.parse(stamp))
        .filter((time) => !Number.isNaN(time));
    if (stamps.length === 0)
        return true;
    return stamps.some((time) => time + TIMESTAMP_SKEW_MS >= startedAt);
}
function mapManagementError(error, action) {
    if (error instanceof CliProxyManagementError) {
        if (error.code === "not_found" || error.code === "conflict")
            return new ProxyAccountError("flow_expired", `CLIProxyAPI account flow expired during ${action}`, { cause: error });
        if (error.code === "bad_request")
            return new ProxyAccountError("callback_invalid", `CLIProxyAPI rejected the account callback during ${action}`, { cause: error });
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    return new ProxyAccountError("upstream_unavailable", `CLIProxyAPI account flow is unavailable during ${action}`, { cause });
}
async function attempt(action, task) {
    try {
        return await task();
    }
    catch (error) {
        throw mapManagementError(error, action);
    }
}
export function createCliProxyAccountConnector(options) {
    const parsed = OptionsSchema.parse(options);
    const providers = parsed.providers ?? ["anthropic"];
    const now = parsed.now ?? Date.now;
    const secret = parsed.sessionSecret ?? parsed.managementKey;
    const slot = parsed.loginSlot ?? sharedLoginSlot();
    const prefixFor = parsed.routePrefix ?? defaultCliProxyRoutePrefix;
    const management = createCliProxyManagementClient({ baseUrl: parsed.baseUrl, managementKey: parsed.managementKey, ...(parsed.fetch === undefined ? {} : { fetch: parsed.fetch }) });
    const clientBase = parsed.baseUrl.replace(/\/+$/, "");
    const releaseSlot = (data) => slot.release(LOGIN_SLOT_KEY, data.slotOwner).catch(() => undefined);
    function resolvePrefix(tenantId) {
        const prefix = prefixFor(tenantId);
        if (!validPrefix(prefix))
            throw new ProxyAccountError("callback_invalid", "CLIProxyAPI tenant route prefix is invalid");
        return prefix;
    }
    return {
        providerIds: providers,
        warning: (providerId) => getCliProxyHostedWarning(providerId),
        async start(target) {
            const parsedTarget = TargetSchema.parse(target);
            const proxyProvider = toProxyProvider(parsedTarget.providerId);
            if (!providers.includes(parsedTarget.providerId))
                throw new ProxyAccountError("upstream_unavailable", `CLIProxyAPI account login is not enabled for provider ${parsedTarget.providerId}`);
            const slotOwner = randomUUID();
            if (!(await slot.acquire(LOGIN_SLOT_KEY, slotOwner, SESSION_TTL_MS)))
                throw new ProxyAccountError("login_busy", "Another workspace is connecting its Claude account; try again shortly");
            let names;
            let authUrl;
            try {
                names = (await management.listCredentials()).map((file) => file.name);
                authUrl = await management.requestAuthUrl(proxyProvider);
            }
            catch (error) {
                await slot.release(LOGIN_SLOT_KEY, slotOwner).catch(() => undefined);
                throw mapManagementError(error, "start");
            }
            const startedAt = now();
            const data = { v: 2, state: authUrl.state, names, tenantId: parsedTarget.tenantId, providerId: parsedTarget.providerId, startedAt, slotOwner };
            return { authorizationUrl: authUrl.url, callbackPrefix: CLIPROXY_CALLBACK_PREFIX, session: signSession(secret, data), expiresAt: startedAt + SESSION_TTL_MS };
        },
        async submitCallback(session, redirectUrl) {
            const data = verifySession(secret, session.session);
            requireTarget(data, session);
            let url;
            try {
                url = new URL(redirectUrl);
            }
            catch {
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback URL is invalid");
            }
            if (!redirectUrl.startsWith(CLIPROXY_CALLBACK_PREFIX))
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback URL has an unexpected prefix");
            if (url.searchParams.get("state") !== data.state)
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback state does not match");
            if (url.searchParams.get("code") === null && url.searchParams.get("error") === null)
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback carries no code");
            await attempt("callback", () => management.submitCallbackRedirect(toProxyProvider(data.providerId), redirectUrl));
        },
        async poll(session) {
            const data = verifySession(secret, session.session);
            requireTarget(data, session);
            if (now() > data.startedAt + SESSION_TTL_MS) {
                await releaseSlot(data);
                throw new ProxyAccountError("flow_expired", "CLIProxyAPI account flow expired or is unknown");
            }
            const status = await attempt("poll", () => management.oauthStatus(data.state));
            if (status.status === "wait")
                return { kind: "pending" };
            if (status.status === "error") {
                await releaseSlot(data);
                if (status.error !== undefined && /unknown or expired/i.test(status.error))
                    throw new ProxyAccountError("flow_expired", "CLIProxyAPI account flow expired");
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account authorization failed", { cause: status.error ?? "authentication failed" });
            }
            const files = await attempt("poll", () => management.listCredentials());
            const known = new Set(data.names);
            const fresh = files.filter((file) => !known.has(file.name) && (file.provider === "claude" || file.type === "claude"));
            // Fail closed: zero files means the same Claude account already exists
            // (filenames derive from account identity), and several means we cannot
            // tell which file is ours. Never bind another tenant's file.
            if (fresh.length !== 1 || fresh[0] === undefined) {
                await releaseSlot(data);
                throw new ProxyAccountError("account_in_use", "This Claude account is already connected; one account maps to one workspace");
            }
            const found = fresh[0];
            if (!freshEnough(found, data.startedAt)) {
                await releaseSlot(data);
                throw new ProxyAccountError("account_in_use", "This Claude account is already connected; one account maps to one workspace");
            }
            const routePrefix = resolvePrefix(data.tenantId);
            const stored = await attempt("poll", () => management.downloadCredential(found.name));
            if (stored.prefix !== undefined && stored.prefix !== "" && stored.prefix !== routePrefix) {
                await releaseSlot(data);
                throw new ProxyAccountError("account_in_use", "This Claude account is already connected to another workspace");
            }
            try {
                await management.patchCredentialPrefix(found.name, routePrefix);
            }
            catch (error) {
                // Never delete: with concurrent management clients the fresh file may
                // belong to another tenant. Leave it and ask the host to clean up.
                await releaseSlot(data);
                throw mapManagementError(error, "poll");
            }
            await releaseSlot(data);
            const binding = { credentialName: found.name, routePrefix, ...(found.email === undefined ? {} : { email: found.email }) };
            return { kind: "connected", binding };
        },
        async cancel(session) {
            let data;
            try {
                data = verifySession(secret, session.session);
            }
            catch {
                return;
            }
            requireTarget(data, session);
            await releaseSlot(data);
            try {
                await management.cancelSession(data.state);
            }
            catch (error) {
                if (error instanceof CliProxyManagementError && error.code === "not_found")
                    return;
                throw mapManagementError(error, "cancel");
            }
        },
        async models(binding) {
            const parsedBinding = BindingSchema.parse(binding);
            const entries = await attempt("models", () => management.credentialModels(parsedBinding.credentialName));
            return entries.map((entry) => ({ id: entry.id, name: entry.displayName ?? entry.id }));
        },
        async disconnect(target, binding) {
            const parsedTarget = TargetSchema.parse(target);
            const parsedBinding = BindingSchema.parse(binding);
            const expected = resolvePrefix(parsedTarget.tenantId);
            if (parsedBinding.routePrefix !== expected)
                throw new ProxyAccountError("account_in_use", "This credential was not created for this workspace");
            const stored = await management.downloadCredential(parsedBinding.credentialName).catch((error) => {
                if (error instanceof CliProxyManagementError && error.code === "not_found")
                    return undefined;
                throw mapManagementError(error, "disconnect");
            });
            if (stored === undefined)
                return;
            if (stored.prefix !== expected)
                throw new ProxyAccountError("account_in_use", "This credential is in use by another workspace");
            try {
                await management.deleteCredential(parsedBinding.credentialName);
            }
            catch (error) {
                if (error instanceof CliProxyManagementError && error.code === "not_found")
                    return;
                throw mapManagementError(error, "disconnect");
            }
        },
        route(binding, modelId) {
            const parsedBinding = BindingSchema.parse(binding);
            if (modelId === "" || modelId.includes("/"))
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI model id is invalid");
            // CLIProxyAPI serves OpenAI chat completions for Claude accounts at /v1;
            // Anthropic messages at /v1/messages works too (wire "anthropic-messages").
            return { baseUrl: `${clientBase}/v1`, headers: { Authorization: `Bearer ${parsed.clientApiKey}` }, model: `${parsedBinding.routePrefix}/${modelId}`, wire: "openai-chat" };
        },
    };
}
//# sourceMappingURL=cliproxyapi-connector.js.map