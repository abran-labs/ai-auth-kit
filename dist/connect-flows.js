import { exchangeChatGptCode, parseChatGptCallback, startChatGptAuthorization } from "./chatgpt-plan.js";
import { chatGptPlanMetadata, chatGptPlanSecretRefs, CLIPROXYAPI_ACCOUNT_ADAPTER } from "./chatgpt-plan-credential.js";
import { CHATGPT_PASTE_INSTRUCTIONS, connectedStep, ConnectError, flowExpiry, isoDate, loadPending, newFlowId, PROXY_PASTE_INSTRUCTIONS, } from "./connect-flow-state.js";
import { PROXY_POLL_AFTER_MS } from "./connect-runtime.js";
export async function startFlow(context, tenantId, providerId, method, fresh) {
    const provider = context.findProvider(providerId);
    if (provider === undefined)
        throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
    const offer = context.hostedMethods(provider).find((entry) => entry.method === method);
    if (offer === undefined)
        throw new ConnectError("method_unavailable", `That sign-in method is unavailable for ${provider.name}.`, false);
    switch (offer.flow) {
        case "secret": {
            const flowId = newFlowId();
            const expiresAt = flowExpiry(context.now());
            await context.pendingFlows.put(flowId, tenantId, JSON.stringify({ kind: "secret", providerId: provider.id, expiresAt }), expiresAt);
            return { kind: "step", step: { kind: "secret-input", flowId, providerId: provider.id, label: `Paste your ${provider.name} API key` } };
        }
        case "chatgpt-plan": {
            const kit = context.kitFor(tenantId);
            const saved = await kit.getCredential(provider.id);
            const savedMetadata = saved?.type === "oauth-external" ? saved.metadata : undefined;
            const authorization = startChatGptAuthorization({
                agentName: context.agentName,
                hostId: context.hostId,
                port: context.callbackPort,
                ...(fresh || savedMetadata?.clientId === undefined ? {} : { clientId: savedMetadata.clientId }),
                ...(fresh || savedMetadata?.email === undefined ? {} : { loginHint: savedMetadata.email }),
            });
            const flowId = newFlowId();
            const expiresAt = flowExpiry(context.now());
            await context.pendingFlows.put(flowId, tenantId, JSON.stringify({ kind: "chatgpt-plan", providerId: provider.id, authorization: authorization.pending, expiresAt }), expiresAt);
            return {
                kind: "step",
                step: { kind: "redirect-paste", flowId, providerId: provider.id, authorizationUrl: authorization.authorizationUrl, callbackPrefix: authorization.pending.redirectUri, instructions: CHATGPT_PASTE_INSTRUCTIONS, expiresAt: isoDate(authorization.pending.expiresAt) },
            };
        }
        case "proxy-account": {
            const connector = context.proxyAccounts;
            if (connector === undefined)
                throw new ConnectError("method_unavailable", `That sign-in method is unavailable for ${provider.name}.`, false);
            if (!provider.authMethods.includes("oauth-external"))
                throw new ConnectError("method_unavailable", `That sign-in method is unavailable for ${provider.name}.`, false);
            const flowId = newFlowId();
            const expiresAt = flowExpiry(context.now());
            if (connector.warning(provider.id).trim().length === 0) {
                const started = await connector.start({ tenantId, providerId: provider.id });
                await context.pendingFlows.put(flowId, tenantId, JSON.stringify({ kind: "proxy-account", providerId: provider.id, stage: "callback", session: started.session, expiresAt }), expiresAt);
                return { kind: "step", step: { kind: "redirect-paste", flowId, providerId: provider.id, authorizationUrl: started.authorizationUrl, callbackPrefix: started.callbackPrefix, instructions: PROXY_PASTE_INSTRUCTIONS, expiresAt: isoDate(started.expiresAt) } };
            }
            await context.pendingFlows.put(flowId, tenantId, JSON.stringify({ kind: "proxy-account", providerId: provider.id, stage: "risk-confirm", expiresAt }), expiresAt);
            return { kind: "step", step: { kind: "confirm-risk", flowId, providerId: provider.id, message: connector.warning(provider.id) } };
        }
    }
}
async function beginProxyCallback(context, tenantId, provider, flowId, expiresAt) {
    const connector = context.proxyAccounts;
    if (connector === undefined)
        throw new ConnectError("method_unavailable", `That sign-in method is unavailable for ${provider.name}.`, false);
    const started = await connector.start({ tenantId, providerId: provider.id });
    await context.pendingFlows.put(flowId, tenantId, JSON.stringify({ kind: "proxy-account", providerId: provider.id, stage: "callback", session: started.session, expiresAt }), expiresAt);
    return { kind: "step", step: { kind: "redirect-paste", flowId, providerId: provider.id, authorizationUrl: started.authorizationUrl, callbackPrefix: started.callbackPrefix, instructions: PROXY_PASTE_INSTRUCTIONS, expiresAt: isoDate(started.expiresAt) } };
}
export async function submitFlow(context, tenantId, flowId, input) {
    const peeked = await loadPending(context, tenantId, flowId, false);
    switch (peeked.kind) {
        case "secret": {
            if (input.kind !== "secret")
                throw new ConnectError("invalid_request", "Invalid request.", false);
            return submitSecret(context, tenantId, flowId, peeked.providerId, input.value);
        }
        case "chatgpt-plan": {
            if (input.kind !== "redirect-url")
                throw new ConnectError("invalid_request", "Invalid request.", false);
            return submitChatGpt(context, tenantId, flowId, input.value);
        }
        case "proxy-account": {
            if (peeked.stage === "risk-confirm") {
                if (input.kind !== "confirm")
                    throw new ConnectError("invalid_request", "Invalid request.", false);
                const provider = context.findProvider(peeked.providerId);
                if (provider === undefined)
                    throw new ConnectError("unknown_provider", `Unknown provider: ${peeked.providerId}`, false);
                if (!input.accepted) {
                    await context.pendingFlows.delete(flowId, tenantId);
                    return { kind: "cancelled" };
                }
                return beginProxyCallback(context, tenantId, provider, flowId, peeked.expiresAt);
            }
            if (input.kind !== "redirect-url")
                throw new ConnectError("invalid_request", "Invalid request.", false);
            if (peeked.session === undefined)
                throw new ConnectError("internal", "Something went wrong. Try again.", true);
            const connector = context.proxyAccounts;
            if (connector === undefined)
                throw new ConnectError("internal", "Something went wrong. Try again.", true);
            await connector.submitCallback({ tenantId, providerId: peeked.providerId, session: peeked.session }, input.value.trim());
            return { kind: "step", step: { kind: "working", flowId, providerId: peeked.providerId, message: "Waiting for the account sign-in to complete.", pollAfterMs: PROXY_POLL_AFTER_MS } };
        }
    }
}
async function submitSecret(context, tenantId, flowId, providerId, value) {
    const key = value.trim();
    if (key.length === 0)
        throw new ConnectError("credential_rejected", "That API key was rejected. Check it and try again.", false);
    if (context.validateApiKey !== undefined) {
        const verdict = await context.validateApiKey(providerId, key);
        if (verdict === "invalid")
            throw new ConnectError("credential_rejected", "That API key was rejected. Check it and try again.", false);
    }
    await context.kitFor(tenantId).saveApiKey(providerId, key);
    await context.pendingFlows.delete(flowId, tenantId);
    return connectedStep(context, tenantId, providerId);
}
async function submitChatGpt(context, tenantId, flowId, value) {
    const pending = await loadPending(context, tenantId, flowId, true);
    if (pending.kind !== "chatgpt-plan")
        throw new ConnectError("invalid_request", "Invalid request.", false);
    const now = context.now();
    const callback = parseChatGptCallback(value, pending.authorization, now);
    const signIn = await exchangeChatGptCode({
        code: callback.code,
        clientId: callback.clientId,
        pending: pending.authorization,
        ...(context.fetch === undefined ? {} : { fetch: context.fetch }),
        now,
    });
    const kit = context.kitFor(tenantId);
    const refs = chatGptPlanSecretRefs(pending.providerId);
    await kit.secrets.set(refs.accessTokenRef, signIn.accessToken);
    await kit.secrets.set(refs.refreshTokenRef, signIn.refreshToken);
    const stored = { ...chatGptPlanMetadata(signIn, refs) };
    delete stored.idTokenRef;
    await kit.saveExternalOAuth(pending.providerId, stored);
    return connectedStep(context, tenantId, pending.providerId);
}
export async function pollFlow(context, tenantId, flowId) {
    const pending = await loadPending(context, tenantId, flowId, false);
    if (pending.kind !== "proxy-account" || pending.stage !== "callback" || pending.session === undefined) {
        throw new ConnectError("invalid_request", "Invalid request.", false);
    }
    const connector = context.proxyAccounts;
    if (connector === undefined)
        throw new ConnectError("internal", "Something went wrong. Try again.", true);
    const provider = context.findProvider(pending.providerId);
    if (provider === undefined)
        throw new ConnectError("unknown_provider", `Unknown provider: ${pending.providerId}`, false);
    const progress = await connector.poll({ tenantId, providerId: pending.providerId, session: pending.session });
    if (progress.kind === "pending") {
        return { kind: "step", step: { kind: "working", flowId, providerId: pending.providerId, message: "Waiting for the account sign-in to complete.", pollAfterMs: PROXY_POLL_AFTER_MS } };
    }
    await context.kitFor(tenantId).saveExternalOAuth(pending.providerId, {
        adapter: CLIPROXYAPI_ACCOUNT_ADAPTER,
        credentialName: progress.binding.credentialName,
        routePrefix: progress.binding.routePrefix,
        ...(progress.binding.email === undefined ? {} : { email: progress.binding.email }),
    });
    await context.pendingFlows.delete(flowId, tenantId);
    return connectedStep(context, tenantId, pending.providerId);
}
export async function cancelFlow(context, tenantId, flowId) {
    const pending = await loadPending(context, tenantId, flowId, false);
    if (pending.kind === "proxy-account" && pending.stage === "callback" && pending.session !== undefined) {
        await context.proxyAccounts?.cancel({ tenantId, providerId: pending.providerId, session: pending.session }).catch(() => undefined);
    }
    await context.pendingFlows.delete(flowId, tenantId);
    return { kind: "cancelled" };
}
//# sourceMappingURL=connect-flows.js.map