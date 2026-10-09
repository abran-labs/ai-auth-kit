import { z } from "zod";
export declare const CONNECT_PROTOCOL_VERSION: 1;
export declare const CHATGPT_USAGE_URL: "https://chatgpt.com/settings/usage";
export declare const FlowIdSchema: z.ZodString;
export declare const ConnectMethodSchema: z.ZodEnum<{
    "api-key": "api-key";
    account: "account";
}>;
export declare const ConnectFlowSchema: z.ZodEnum<{
    "chatgpt-plan": "chatgpt-plan";
    secret: "secret";
    "proxy-account": "proxy-account";
}>;
export declare const ConnectMethodOptionSchema: z.ZodReadonly<z.ZodObject<{
    method: z.ZodEnum<{
        "api-key": "api-key";
        account: "account";
    }>;
    flow: z.ZodEnum<{
        "chatgpt-plan": "chatgpt-plan";
        secret: "secret";
        "proxy-account": "proxy-account";
    }>;
    label: z.ZodString;
    hint: z.ZodOptional<z.ZodString>;
    risk: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const ConnectProviderSchema: z.ZodReadonly<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    featured: z.ZodBoolean;
    methods: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        method: z.ZodEnum<{
            "api-key": "api-key";
            account: "account";
        }>;
        flow: z.ZodEnum<{
            "chatgpt-plan": "chatgpt-plan";
            secret: "secret";
            "proxy-account": "proxy-account";
        }>;
        label: z.ZodString;
        hint: z.ZodOptional<z.ZodString>;
        risk: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    docsUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const ConnectModelSchema: z.ZodReadonly<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    contextWindow: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>>;
export declare const ConnectUsageSchema: z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"chatgpt-plan">;
    manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
}, z.core.$strip>>;
export declare const ConnectionSchema: z.ZodReadonly<z.ZodObject<{
    providerId: z.ZodString;
    providerName: z.ZodString;
    method: z.ZodEnum<{
        "api-key": "api-key";
        account: "account";
    }>;
    account: z.ZodOptional<z.ZodString>;
    health: z.ZodEnum<{
        "reconnect-required": "reconnect-required";
        connected: "connected";
    }>;
    usage: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"chatgpt-plan">;
        manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
    }, z.core.$strip>>>;
    connectedAt: z.ZodString;
}, z.core.$strip>>;
export declare const SelectedModelSummarySchema: z.ZodReadonly<z.ZodObject<{
    providerId: z.ZodString;
    modelId: z.ZodString;
    modelName: z.ZodString;
}, z.core.$strip>>;
export declare const ConnectStatusSchema: z.ZodReadonly<z.ZodObject<{
    connections: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        providerId: z.ZodString;
        providerName: z.ZodString;
        method: z.ZodEnum<{
            "api-key": "api-key";
            account: "account";
        }>;
        account: z.ZodOptional<z.ZodString>;
        health: z.ZodEnum<{
            "reconnect-required": "reconnect-required";
            connected: "connected";
        }>;
        usage: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
            kind: z.ZodLiteral<"chatgpt-plan">;
            manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
        }, z.core.$strip>>>;
        connectedAt: z.ZodString;
    }, z.core.$strip>>>>;
    selectedModel: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
        providerId: z.ZodString;
        modelId: z.ZodString;
        modelName: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>>;
export declare const ConnectStepSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"secret-input">;
    flowId: z.ZodString;
    providerId: z.ZodString;
    label: z.ZodString;
    placeholder: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"confirm-risk">;
    flowId: z.ZodString;
    providerId: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"redirect-paste">;
    flowId: z.ZodString;
    providerId: z.ZodString;
    authorizationUrl: z.ZodURL;
    callbackPrefix: z.ZodString;
    instructions: z.ZodString;
    expiresAt: z.ZodISODateTime;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"working">;
    flowId: z.ZodString;
    providerId: z.ZodString;
    message: z.ZodString;
    pollAfterMs: z.ZodNumber;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"connected">;
    connection: z.ZodReadonly<z.ZodObject<{
        providerId: z.ZodString;
        providerName: z.ZodString;
        method: z.ZodEnum<{
            "api-key": "api-key";
            account: "account";
        }>;
        account: z.ZodOptional<z.ZodString>;
        health: z.ZodEnum<{
            "reconnect-required": "reconnect-required";
            connected: "connected";
        }>;
        usage: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
            kind: z.ZodLiteral<"chatgpt-plan">;
            manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
        }, z.core.$strip>>>;
        connectedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>>], "kind">;
export declare const ConnectRequestSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"providers">;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"status">;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"start">;
    providerId: z.ZodString;
    method: z.ZodEnum<{
        "api-key": "api-key";
        account: "account";
    }>;
    fresh: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"submit">;
    flowId: z.ZodString;
    input: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"secret">;
        value: z.ZodString;
    }, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"redirect-url">;
        value: z.ZodString;
    }, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"confirm">;
        accepted: z.ZodBoolean;
    }, z.core.$strict>>], "kind">;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"poll">;
    flowId: z.ZodString;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"cancel">;
    flowId: z.ZodString;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"models">;
    providerId: z.ZodString;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"select-model">;
    providerId: z.ZodString;
    modelId: z.ZodString;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    op: z.ZodLiteral<"disconnect">;
    providerId: z.ZodString;
}, z.core.$strict>>], "op">;
export declare const ConnectErrorCodeSchema: z.ZodEnum<{
    callback_invalid: "callback_invalid";
    access_denied: "access_denied";
    plan_not_granted: "plan_not_granted";
    upstream_unavailable: "upstream_unavailable";
    invalid_request: "invalid_request";
    unknown_provider: "unknown_provider";
    method_unavailable: "method_unavailable";
    flow_not_found: "flow_not_found";
    flow_expired: "flow_expired";
    credential_rejected: "credential_rejected";
    account_in_use: "account_in_use";
    not_connected: "not_connected";
    unknown_model: "unknown_model";
    internal: "internal";
}>;
export declare const ConnectResponseSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"providers">;
    providers: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        featured: z.ZodBoolean;
        methods: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            method: z.ZodEnum<{
                "api-key": "api-key";
                account: "account";
            }>;
            flow: z.ZodEnum<{
                "chatgpt-plan": "chatgpt-plan";
                secret: "secret";
                "proxy-account": "proxy-account";
            }>;
            label: z.ZodString;
            hint: z.ZodOptional<z.ZodString>;
            risk: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>>;
        docsUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"status">;
    status: z.ZodReadonly<z.ZodObject<{
        connections: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            providerId: z.ZodString;
            providerName: z.ZodString;
            method: z.ZodEnum<{
                "api-key": "api-key";
                account: "account";
            }>;
            account: z.ZodOptional<z.ZodString>;
            health: z.ZodEnum<{
                "reconnect-required": "reconnect-required";
                connected: "connected";
            }>;
            usage: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                kind: z.ZodLiteral<"chatgpt-plan">;
                manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
            }, z.core.$strip>>>;
            connectedAt: z.ZodString;
        }, z.core.$strip>>>>;
        selectedModel: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
            providerId: z.ZodString;
            modelId: z.ZodString;
            modelName: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"step">;
    step: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"secret-input">;
        flowId: z.ZodString;
        providerId: z.ZodString;
        label: z.ZodString;
        placeholder: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"confirm-risk">;
        flowId: z.ZodString;
        providerId: z.ZodString;
        message: z.ZodString;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"redirect-paste">;
        flowId: z.ZodString;
        providerId: z.ZodString;
        authorizationUrl: z.ZodURL;
        callbackPrefix: z.ZodString;
        instructions: z.ZodString;
        expiresAt: z.ZodISODateTime;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"working">;
        flowId: z.ZodString;
        providerId: z.ZodString;
        message: z.ZodString;
        pollAfterMs: z.ZodNumber;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        kind: z.ZodLiteral<"connected">;
        connection: z.ZodReadonly<z.ZodObject<{
            providerId: z.ZodString;
            providerName: z.ZodString;
            method: z.ZodEnum<{
                "api-key": "api-key";
                account: "account";
            }>;
            account: z.ZodOptional<z.ZodString>;
            health: z.ZodEnum<{
                "reconnect-required": "reconnect-required";
                connected: "connected";
            }>;
            usage: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                kind: z.ZodLiteral<"chatgpt-plan">;
                manageUrl: z.ZodLiteral<"https://chatgpt.com/settings/usage">;
            }, z.core.$strip>>>;
            connectedAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>], "kind">;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"models">;
    providerId: z.ZodString;
    models: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        contextWindow: z.ZodOptional<z.ZodNumber>;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"cancelled">;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"error">;
    code: z.ZodEnum<{
        callback_invalid: "callback_invalid";
        access_denied: "access_denied";
        plan_not_granted: "plan_not_granted";
        upstream_unavailable: "upstream_unavailable";
        invalid_request: "invalid_request";
        unknown_provider: "unknown_provider";
        method_unavailable: "method_unavailable";
        flow_not_found: "flow_not_found";
        flow_expired: "flow_expired";
        credential_rejected: "credential_rejected";
        account_in_use: "account_in_use";
        not_connected: "not_connected";
        unknown_model: "unknown_model";
        internal: "internal";
    }>;
    message: z.ZodString;
    retryable: z.ZodBoolean;
}, z.core.$strip>>], "kind">;
export type ConnectMethod = z.output<typeof ConnectMethodSchema>;
export type ConnectFlow = z.output<typeof ConnectFlowSchema>;
export type ConnectMethodOption = z.output<typeof ConnectMethodOptionSchema>;
export type ConnectProvider = z.output<typeof ConnectProviderSchema>;
export type ConnectModel = z.output<typeof ConnectModelSchema>;
export type ConnectUsage = z.output<typeof ConnectUsageSchema>;
export type Connection = z.output<typeof ConnectionSchema>;
export type SelectedModelSummary = z.output<typeof SelectedModelSummarySchema>;
export type ConnectStatus = z.output<typeof ConnectStatusSchema>;
export type ConnectStep = z.output<typeof ConnectStepSchema>;
export type ConnectRequest = z.output<typeof ConnectRequestSchema>;
export type ConnectErrorCode = z.output<typeof ConnectErrorCodeSchema>;
export type ConnectResponse = z.output<typeof ConnectResponseSchema>;
export declare function parseConnectRequest(input: unknown): ConnectRequest;
export declare function parseConnectResponse(input: unknown): ConnectResponse;
