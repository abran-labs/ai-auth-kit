import { z } from "zod";
import type { AuthKitState } from "./types.js";

const isoDate = z.string().min(1);

const apiKeyCredential = z.object({
  type: z.literal("api-key"),
  secretRef: z.string().min(1),
  createdAt: isoDate
});

const envCredential = z.object({
  type: z.literal("env"),
  envVar: z.string().min(1),
  createdAt: isoDate
});

const externalOAuthCredential = z.object({
  type: z.literal("oauth-external"),
  metadata: z.record(z.string(), z.string()),
  createdAt: isoDate
});

const noAuthCredential = z.object({
  type: z.literal("none"),
  createdAt: isoDate
});

const modelDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contextWindow: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const providerDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  envVars: z.array(z.string().min(1)),
  authMethods: z.array(z.enum(["api-key", "env", "oauth-external", "none"])),
  models: z.array(modelDefinitionSchema),
  docsUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const storedCredentialSchema = z.discriminatedUnion("type", [
  apiKeyCredential,
  envCredential,
  externalOAuthCredential,
  noAuthCredential
]);

export const authKitStateSchema = z.object({
  credentials: z.record(z.string(), storedCredentialSchema),
  selectedModel: z
    .object({
      providerId: z.string().min(1),
      modelId: z.string().min(1),
      updatedAt: isoDate,
      snapshot: z.object({ provider: providerDefinitionSchema, model: modelDefinitionSchema }).optional(),
    })
    .optional(),
  updatedAt: isoDate
});

export function parseState(input: unknown): AuthKitState {
  return authKitStateSchema.parse(input);
}
