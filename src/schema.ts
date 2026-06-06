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
      updatedAt: isoDate
    })
    .optional(),
  updatedAt: isoDate
});

export function parseState(input: unknown): AuthKitState {
  return authKitStateSchema.parse(input);
}
