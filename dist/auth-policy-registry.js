import { z } from "zod";
const AUTH_METHODS = ["api-key", "env", "oauth-external"];
const SPECIALIZED_ADAPTERS = ["openai-account", "copilot-account", "anthropic-account", "google-account"];
export const AuthPolicySchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("generic-api-key"),
        methods: z.tuple([z.literal("api-key"), z.literal("env")]).readonly(),
        envNames: z.array(z.string()).readonly(),
    }).readonly(),
    z.object({
        kind: z.literal("specialized"),
        methods: z.array(z.enum(AUTH_METHODS)).readonly(),
        envNames: z.array(z.string()).readonly(),
        adapter: z.enum(SPECIALIZED_ADAPTERS),
    }).readonly(),
    z.object({
        kind: z.literal("unavailable"),
        methods: z.tuple([]).readonly(),
        envNames: z.tuple([]).readonly(),
    }).readonly(),
]);
const LOCAL_AUTH_POLICIES = {
    openai: {
        kind: "specialized",
        methods: ["api-key", "env", "oauth-external"],
        envNames: ["OPENAI_API_KEY"],
        adapter: "openai-account",
    },
    "github-copilot": {
        kind: "specialized",
        methods: ["env", "oauth-external"],
        envNames: ["GITHUB_TOKEN", "GH_TOKEN", "COPILOT_GITHUB_TOKEN"],
        adapter: "copilot-account",
    },
    anthropic: {
        kind: "specialized",
        methods: ["api-key", "env", "oauth-external"],
        envNames: ["ANTHROPIC_API_KEY"],
        adapter: "anthropic-account",
    },
    google: {
        kind: "specialized",
        methods: ["api-key", "env", "oauth-external"],
        envNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
        adapter: "google-account",
    },
};
function freezePolicy(policy) {
    switch (policy.kind) {
        case "generic-api-key":
            return Object.freeze({
                kind: "generic-api-key",
                methods: Object.freeze(["api-key", "env"]),
                envNames: Object.freeze([...policy.envNames]),
            });
        case "specialized":
            return Object.freeze({
                kind: "specialized",
                methods: Object.freeze([...policy.methods]),
                envNames: Object.freeze([...policy.envNames]),
                adapter: policy.adapter,
            });
        case "unavailable":
            return Object.freeze({
                kind: "unavailable",
                methods: Object.freeze([]),
                envNames: Object.freeze([]),
            });
    }
}
export function getAuthPolicy(providerId, sourceEnvNames) {
    const localPolicy = LOCAL_AUTH_POLICIES[providerId];
    if (localPolicy !== undefined)
        return freezePolicy(localPolicy);
    if (sourceEnvNames.length > 0) {
        return freezePolicy({
            kind: "generic-api-key",
            methods: ["api-key", "env"],
            envNames: [...sourceEnvNames],
        });
    }
    return freezePolicy({ kind: "unavailable", methods: [], envNames: [] });
}
//# sourceMappingURL=auth-policy-registry.js.map