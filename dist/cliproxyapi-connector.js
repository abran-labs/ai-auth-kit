import { createHash } from "node:crypto";
import { z } from "zod";
import { CliProxyManagementError, createCliProxyManagementClient, } from "./cliproxyapi-management.js";
import { ProxyAccountError, } from "./hosted-types.js";
export const CLIPROXY_CALLBACK_PREFIX = "http://localhost:54545/callback";
const SESSION_TTL_MS = 5 * 60 * 1000;
const KIT_TO_PROXY_PROVIDER = { anthropic: "claude" };
const ProviderSchema = z.enum(["anthropic"]);
const FunctionSchema = z.custom((value) => typeof value === "function");
const FetchSchema = z.custom((value) => typeof value === "function");
const NowSchema = z.custom((value) => typeof value === "function");
const OptionsSchema = z
    .object({
    baseUrl: z.string().min(1).max(2048),
    managementKey: z.string().min(1).max(4096),
    clientApiKey: z.string().min(1).max(4096),
    providers: z.array(ProviderSchema).readonly().optional(),
    routePrefix: FunctionSchema.optional(),
    fetch: FetchSchema.optional(),
    now: NowSchema.optional(),
})
    .readonly();
const SessionSchema = z
    .object({
    v: z.literal(1),
    state: z.string().min(1).max(256),
    names: z.array(z.string().max(1024)).readonly(),
    tenantId: z.string().min(1).max(256),
    providerId: z.string().min(1).max(256),
})
    .readonly();
const TargetSchema = z.object({ tenantId: z.string().min(1).max(256), providerId: z.string().min(1).max(256) }).readonly();
const BindingSchema = z
    .object({ credentialName: z.string().min(1).max(1024), routePrefix: z.string().min(1).max(64), email: z.string().max(1024).optional() })
    .readonly();
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
function decodeSession(session) {
    try {
        return SessionSchema.parse(JSON.parse(session));
    }
    catch {
        throw new ProxyAccountError("flow_expired", "CLIProxyAPI account flow expired or is unknown");
    }
}
function mapManagementError(error, action) {
    if (error instanceof CliProxyManagementError) {
        if (error.code === "not_found" || error.code === "conflict") {
            return new ProxyAccountError("flow_expired", `CLIProxyAPI account flow expired during ${action}`, { cause: error });
        }
        if (error.code === "bad_request") {
            return new ProxyAccountError("callback_invalid", `CLIProxyAPI rejected the account callback during ${action}`, { cause: error });
        }
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    return new ProxyAccountError("upstream_unavailable", `CLIProxyAPI account flow is unavailable during ${action}`, { cause });
}
export function createCliProxyAccountConnector(options) {
    const parsed = OptionsSchema.parse(options);
    const providers = parsed.providers ?? ["anthropic"];
    const now = parsed.now ?? Date.now;
    const prefixFor = parsed.routePrefix ?? defaultCliProxyRoutePrefix;
    const management = createCliProxyManagementClient({
        baseUrl: parsed.baseUrl,
        managementKey: parsed.managementKey,
        ...(parsed.fetch === undefined ? {} : { fetch: parsed.fetch }),
    });
    const clientBase = parsed.baseUrl.replace(/\/+$/, "");
    function resolvePrefix(tenantId) {
        const prefix = prefixFor(tenantId);
        if (!validPrefix(prefix))
            throw new ProxyAccountError("callback_invalid", "CLIProxyAPI tenant route prefix is invalid");
        return prefix;
    }
    return {
        providerIds: providers,
        warning(providerId) {
            return getCliProxyHostedWarning(providerId);
        },
        async start(target) {
            const parsedTarget = TargetSchema.parse(target);
            const proxyProvider = toProxyProvider(parsedTarget.providerId);
            if (!providers.includes(parsedTarget.providerId)) {
                throw new ProxyAccountError("upstream_unavailable", `CLIProxyAPI account login is not enabled for provider ${parsedTarget.providerId}`);
            }
            let names;
            let authUrl;
            try {
                names = (await management.listCredentials()).map((file) => file.name);
                authUrl = await management.requestAuthUrl(proxyProvider);
            }
            catch (error) {
                throw mapManagementError(error, "start");
            }
            const session = { v: 1, state: authUrl.state, names, tenantId: parsedTarget.tenantId, providerId: parsedTarget.providerId };
            return { authorizationUrl: authUrl.url, callbackPrefix: CLIPROXY_CALLBACK_PREFIX, session: JSON.stringify(session), expiresAt: now() + SESSION_TTL_MS };
        },
        async submitCallback(session, redirectUrl) {
            const data = decodeSession(session.session);
            let url;
            try {
                url = new URL(redirectUrl);
            }
            catch {
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback URL is invalid");
            }
            if (!redirectUrl.startsWith(CLIPROXY_CALLBACK_PREFIX)) {
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback URL has an unexpected prefix");
            }
            if (url.searchParams.get("state") !== data.state) {
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback state does not match");
            }
            if (url.searchParams.get("code") === null && url.searchParams.get("error") === null) {
                throw new ProxyAccountError("callback_invalid", "CLIProxyAPI account callback carries no code");
            }
            try {
                await management.submitCallbackRedirect(toProxyProvider(data.providerId), redirectUrl);
            }
            catch (error) {
                throw mapManagementError(error, "callback");
            }
        },
        async poll(session) {
            const data = decodeSession(session.session);
            let status;
            try {
                status = await management.oauthStatus(data.state);
            }
            catch (error) {
                throw mapManagementError(error, "poll");
            }
            if (status.status === "wait")
                return { kind: "pending" };
            if (status.status === "error") {
                if (status.error !== undefined && /unknown or expired/i.test(status.error)) {
                    throw new ProxyAccountError("flow_expired", "CLIProxyAPI account flow expired");
                }
                throw new ProxyAccountError("callback_invalid", `CLIProxyAPI account flow failed: ${status.error ?? "authentication failed"}`);
            }
            let files;
            try {
                files = await management.listCredentials();
            }
            catch (error) {
                throw mapManagementError(error, "poll");
            }
            const known = new Set(data.names);
            const fresh = files.filter((file) => !known.has(file.name) && (file.provider === "claude" || file.type === "claude"));
            // Fail closed: zero files means the same Claude account already exists
            // (filenames derive from account identity), and several means we cannot
            // tell which file is ours. Never bind another tenant's file.
            if (fresh.length !== 1 || fresh[0] === undefined) {
                throw new ProxyAccountError("account_in_use", "This Claude account is already connected; one account maps to one workspace");
            }
            const credentialName = fresh[0].name;
            const routePrefix = resolvePrefix(data.tenantId);
            try {
                await management.patchCredentialPrefix(credentialName, routePrefix);
            }
            catch (error) {
                await management.deleteCredential(credentialName).catch(() => undefined);
                throw mapManagementError(error, "poll");
            }
            const binding = {
                credentialName,
                routePrefix,
                ...(fresh[0].email === undefined ? {} : { email: fresh[0].email }),
            };
            return { kind: "connected", binding };
        },
        async cancel(session) {
            let data;
            try {
                data = decodeSession(session.session);
            }
            catch {
                return;
            }
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
            let entries;
            try {
                entries = await management.credentialModels(parsedBinding.credentialName);
            }
            catch (error) {
                throw mapManagementError(error, "models");
            }
            return entries.map((entry) => ({ id: entry.id, name: entry.displayName ?? entry.id }));
        },
        async disconnect(target, binding) {
            const parsedTarget = TargetSchema.parse(target);
            const parsedBinding = BindingSchema.parse(binding);
            if (parsedBinding.routePrefix !== resolvePrefix(parsedTarget.tenantId)) {
                throw new ProxyAccountError("account_in_use", "This credential was not created for this workspace");
            }
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
            return {
                baseUrl: `${clientBase}/v1`,
                headers: { Authorization: `Bearer ${parsed.clientApiKey}` },
                model: `${parsedBinding.routePrefix}/${modelId}`,
                wire: "openai-chat",
            };
        },
    };
}
//# sourceMappingURL=cliproxyapi-connector.js.map