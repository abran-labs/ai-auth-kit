import { z } from "zod";
export declare const ModelsDevSourceSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    env: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    doc: z.ZodOptional<z.ZodURL>;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        status: z.ZodOptional<z.ZodEnum<{
            alpha: "alpha";
            beta: "beta";
            deprecated: "deprecated";
        }>>;
        modalities: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            input: z.ZodArray<z.ZodString>;
            output: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            context: z.ZodOptional<z.ZodInt>;
            input: z.ZodOptional<z.ZodInt>;
            output: z.ZodOptional<z.ZodInt>;
        }, z.core.$strip>>>;
        cost: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            input: z.ZodOptional<z.ZodNumber>;
            output: z.ZodOptional<z.ZodNumber>;
            cache_read: z.ZodOptional<z.ZodNumber>;
            cache_write: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        reasoning: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        tool_call: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        structured_output: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare const CatalogProvenanceSchema: z.ZodObject<{
    sourceUrl: z.ZodLiteral<"https://models.dev/api.json">;
    sourceSchemaCommit: z.ZodString;
    capturedAt: z.ZodISODateTime;
    etag: z.ZodNullable<z.ZodString>;
    sourceContentSha256: z.ZodString;
}, z.core.$strip>;
export type ModelsDevSource = z.output<typeof ModelsDevSourceSchema>;
export type CatalogProvenance = z.output<typeof CatalogProvenanceSchema>;
