import { z } from "zod";
import { AuthPolicySchema, getAuthPolicy } from "./auth-policy-registry.js";
import { CatalogProvenanceSchema, ModelsDevSourceSchema } from "./catalog-source-schema.js";
const LifecycleStatusSchema = z.enum(["active", "alpha", "beta", "deprecated"]);
const NormalizedModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: LifecycleStatusSchema,
    modalities: z.object({ input: z.array(z.string()).readonly(), output: z.array(z.string()).readonly() }).readonly(),
    limits: z.object({ context: z.number().int().optional(), input: z.number().int().optional(), output: z.number().int().optional() }).readonly().optional(),
    pricing: z.object({ input: z.number().optional(), output: z.number().optional(), cacheRead: z.number().optional(), cacheWrite: z.number().optional() }).readonly().optional(),
    reasoning: z.boolean(),
    tools: z.boolean(),
    structuredOutput: z.boolean(),
}).readonly();
const NormalizedProviderSchema = z.object({
    id: z.string(),
    name: z.string(),
    envNames: z.array(z.string()).readonly(),
    docsUrl: z.string().optional(),
    authPolicy: AuthPolicySchema,
    models: z.array(NormalizedModelSchema).readonly(),
}).readonly();
export const NormalizedCatalogSchema = z.object({
    provenance: CatalogProvenanceSchema,
    providers: z.array(NormalizedProviderSchema).readonly(),
}).readonly();
function compareStrings(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function normalizeModel(model) {
    return {
        id: model.id,
        name: model.name.trim(),
        status: model.status ?? "active",
        modalities: {
            input: [...(model.modalities?.input ?? [])].sort(compareStrings),
            output: [...(model.modalities?.output ?? [])].sort(compareStrings),
        },
        ...(model.limit == null ? {} : {
            limits: { context: model.limit.context, input: model.limit.input, output: model.limit.output },
        }),
        ...(model.cost == null ? {} : {
            pricing: {
                input: model.cost.input,
                output: model.cost.output,
                cacheRead: model.cost.cache_read,
                cacheWrite: model.cost.cache_write,
            },
        }),
        reasoning: model.reasoning,
        tools: model.tool_call,
        structuredOutput: model.structured_output,
    };
}
function normalizeProvider(provider) {
    const envNames = [...provider.env].sort(compareStrings);
    const authPolicy = getAuthPolicy(provider.id, envNames);
    return {
        id: provider.id,
        name: provider.name.trim(),
        envNames,
        ...(provider.doc === undefined ? {} : { docsUrl: provider.doc }),
        authPolicy,
        models: Object.values(provider.models).sort((left, right) => compareStrings(left.id, right.id)).map(normalizeModel),
    };
}
export function normalizeModelsDevCatalog(source, provenance) {
    const parsedSource = ModelsDevSourceSchema.parse(source);
    const parsedProvenance = CatalogProvenanceSchema.parse(provenance);
    const providers = Object.values(parsedSource)
        .sort((left, right) => compareStrings(left.id, right.id))
        .map(normalizeProvider);
    return NormalizedCatalogSchema.parse({ provenance: parsedProvenance, providers });
}
//# sourceMappingURL=catalog-normalize.js.map