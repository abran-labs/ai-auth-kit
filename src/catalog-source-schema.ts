import { z } from "zod";

const PROVIDER_LIMIT = 512;
const MODEL_LIMIT = 1024;
const IDENTIFIER = /^[\p{L}\p{N}@~][\p{L}\p{N}._:/@~+-]*$/u;
const ENVIRONMENT_NAME = /^[A-Z0-9][A-Z0-9_]*$/;
const MODALITY = /^[a-z][a-z0-9-]*$/;
const LIFECYCLE_STATUSES = ["alpha", "beta", "deprecated"] as const;

const IdentifierSchema = z.string().min(1).max(256).regex(IDENTIFIER);
const NameSchema = z.string().min(1).max(256).refine((value) => value.trim().length > 0 && !/https?:\/\//iu.test(value) && ![...value].some((character) => character !== "\t" && /\p{C}/u.test(character)));
const EnvNameSchema = z.string().min(1).max(128).regex(ENVIRONMENT_NAME);
const BoundedNumberSchema = z.number().min(0);
const BoundedIntegerSchema = z.int().min(0);
const LimitSchema = z.object({
  context: BoundedIntegerSchema.optional(),
  input: BoundedIntegerSchema.optional(),
  output: BoundedIntegerSchema.optional(),
}).strip();
const CostSchema = z.object({
  input: BoundedNumberSchema.optional(),
  output: BoundedNumberSchema.optional(),
  cache_read: BoundedNumberSchema.optional(),
  cache_write: BoundedNumberSchema.optional(),
}).strip();
const ModalitiesSchema = z.object({
  input: z.array(z.string().min(1).max(32).regex(MODALITY)).max(16),
  output: z.array(z.string().min(1).max(32).regex(MODALITY)).max(16),
}).strip();
const DocsUrlSchema = z.url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || url.protocol === "http:";
});

const ModelSourceSchema = z.object({
  id: IdentifierSchema,
  name: NameSchema,
  status: z.enum(LIFECYCLE_STATUSES).optional(),
  modalities: ModalitiesSchema.nullish(),
  limit: LimitSchema.nullish(),
  cost: CostSchema.nullish(),
  reasoning: z.boolean().optional().default(false),
  tool_call: z.boolean().optional().default(false),
  structured_output: z.boolean().optional().default(false),
}).strip();

const ModelsSourceSchema = z.record(IdentifierSchema, ModelSourceSchema).superRefine((models, context) => {
  if (Object.keys(models).length > MODEL_LIMIT) {
    context.addIssue({ code: "custom", message: `Model limit is ${MODEL_LIMIT}` });
  }

  const seenIds = new Set<string>();
  for (const [key, model] of Object.entries(models)) {
    if (key !== model.id || seenIds.has(model.id)) {
      context.addIssue({ code: "custom", message: "Model keys and IDs must be unique and equal" });
    }
    seenIds.add(model.id);
  }
});

const ProviderSourceSchema = z.object({
  id: IdentifierSchema,
  name: NameSchema,
  env: z.array(EnvNameSchema).max(16).optional().default([]),
  doc: DocsUrlSchema.optional(),
  models: ModelsSourceSchema,
}).strip();

export const ModelsDevSourceSchema = z.record(IdentifierSchema, ProviderSourceSchema).superRefine((providers, context) => {
  if (Object.keys(providers).length > PROVIDER_LIMIT) {
    context.addIssue({ code: "custom", message: `Provider limit is ${PROVIDER_LIMIT}` });
  }

  const seenIds = new Set<string>();
  for (const [key, provider] of Object.entries(providers)) {
    if (key !== provider.id || seenIds.has(provider.id)) {
      context.addIssue({ code: "custom", message: "Provider keys and IDs must be unique and equal" });
    }
    seenIds.add(provider.id);
  }
});

export const CatalogProvenanceSchema = z.object({
  sourceUrl: z.literal("https://models.dev/api.json"),
  sourceSchemaCommit: z.string().regex(/^[a-f0-9]{40}$/),
  capturedAt: z.iso.datetime({ offset: true }),
  etag: z.string().min(1).max(512).nullable(),
  sourceContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strip();

export type ModelsDevSource = z.output<typeof ModelsDevSourceSchema>;
export type CatalogProvenance = z.output<typeof CatalogProvenanceSchema>;
