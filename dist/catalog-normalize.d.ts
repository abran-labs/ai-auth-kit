import { z } from "zod";
export declare const NormalizedCatalogSchema: z.ZodReadonly<z.ZodObject<{
    provenance: z.ZodObject<{
        sourceUrl: z.ZodLiteral<"https://models.dev/api.json">;
        sourceSchemaCommit: z.ZodString;
        capturedAt: z.ZodISODateTime;
        etag: z.ZodNullable<z.ZodString>;
        sourceContentSha256: z.ZodString;
    }, z.core.$strip>;
    providers: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        envNames: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        docsUrl: z.ZodOptional<z.ZodString>;
        authPolicy: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
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
        models: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            status: z.ZodEnum<{
                alpha: "alpha";
                beta: "beta";
                deprecated: "deprecated";
                active: "active";
            }>;
            modalities: z.ZodReadonly<z.ZodObject<{
                input: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                output: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                context: z.ZodOptional<z.ZodNumber>;
                input: z.ZodOptional<z.ZodNumber>;
                output: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
            pricing: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                input: z.ZodOptional<z.ZodNumber>;
                output: z.ZodOptional<z.ZodNumber>;
                cacheRead: z.ZodOptional<z.ZodNumber>;
                cacheWrite: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
            reasoning: z.ZodBoolean;
            tools: z.ZodBoolean;
            structuredOutput: z.ZodBoolean;
        }, z.core.$strip>>>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>>;
export type NormalizedCatalog = z.output<typeof NormalizedCatalogSchema>;
export declare function normalizeModelsDevCatalog(source: unknown, provenance: unknown): NormalizedCatalog;
