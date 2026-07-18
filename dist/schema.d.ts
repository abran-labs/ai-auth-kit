import { z } from "zod";
import type { AuthKitState } from "./types.js";
export declare const storedCredentialSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"api-key">;
    secretRef: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"env">;
    envVar: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"oauth-external">;
    metadata: z.ZodRecord<z.ZodString, z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"none">;
    createdAt: z.ZodString;
}, z.core.$strip>], "type">;
export declare const authKitStateSchema: z.ZodObject<{
    credentials: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"api-key">;
        secretRef: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"env">;
        envVar: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"oauth-external">;
        metadata: z.ZodRecord<z.ZodString, z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"none">;
        createdAt: z.ZodString;
    }, z.core.$strip>], "type">>;
    selectedModel: z.ZodOptional<z.ZodObject<{
        providerId: z.ZodString;
        modelId: z.ZodString;
        updatedAt: z.ZodString;
        snapshot: z.ZodOptional<z.ZodObject<{
            provider: z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                envVars: z.ZodArray<z.ZodString>;
                authMethods: z.ZodArray<z.ZodEnum<{
                    "api-key": "api-key";
                    env: "env";
                    "oauth-external": "oauth-external";
                    none: "none";
                }>>;
                models: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    contextWindow: z.ZodOptional<z.ZodNumber>;
                    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>;
                docsUrl: z.ZodOptional<z.ZodString>;
                notes: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            model: z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                contextWindow: z.ZodOptional<z.ZodNumber>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare function parseState(input: unknown): AuthKitState;
