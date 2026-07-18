import { z } from "zod";
export declare const AuthPolicySchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"generic-api-key">;
    methods: z.ZodReadonly<z.ZodTuple<[z.ZodLiteral<"api-key">, z.ZodLiteral<"env">], null>>;
    envNames: z.ZodReadonly<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"specialized">;
    methods: z.ZodReadonly<z.ZodArray<z.ZodEnum<{
        "api-key": "api-key";
        env: "env";
        "oauth-external": "oauth-external";
    }>>>;
    envNames: z.ZodReadonly<z.ZodArray<z.ZodString>>;
    adapter: z.ZodEnum<{
        "openai-account": "openai-account";
        "copilot-account": "copilot-account";
        "anthropic-account": "anthropic-account";
        "google-account": "google-account";
    }>;
}, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
    kind: z.ZodLiteral<"unavailable">;
    methods: z.ZodReadonly<z.ZodTuple<[], null>>;
    envNames: z.ZodReadonly<z.ZodTuple<[], null>>;
}, z.core.$strip>>], "kind">;
export type AuthPolicy = z.output<typeof AuthPolicySchema>;
export declare function getAuthPolicy(providerId: string, sourceEnvNames: readonly string[]): AuthPolicy;
