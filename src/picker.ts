import * as prompts from "@clack/prompts";
import type { AuthMethod, ModelDefinition, ProviderDefinition, StoredCredential } from "./types.js";
import type { AuthKit } from "./kit.js";

function isCancel(value: unknown): value is symbol {
  return prompts.isCancel(value);
}

export async function pickProvider(kit: AuthKit, message = "Select provider"): Promise<ProviderDefinition | undefined> {
  const value = await prompts.autocomplete({
    message,
    maxItems: 8,
    options: kit.listProviders().map((provider) => ({
      value: provider.id,
      label: provider.name,
      hint: provider.notes
    }))
  });
  if (isCancel(value)) return undefined;
  return kit.getProvider(value);
}

export async function pickModel(
  kit: AuthKit,
  providerId: string,
  message = "Select model"
): Promise<ModelDefinition | undefined> {
  const value = await prompts.autocomplete({
    message,
    maxItems: 10,
    options: kit.listModels(providerId).map((model) => ({
      value: model.id,
      label: model.name,
      hint: model.tags?.join(", ")
    }))
  });
  if (isCancel(value)) return undefined;
  return kit.getModel(providerId, value);
}

export async function pickAuthMethod(provider: ProviderDefinition): Promise<AuthMethod | undefined> {
  const value = await prompts.select({
    message: "Select auth method",
    options: provider.authMethods.map((method) => ({ value: method, label: method }))
  });
  if (isCancel(value)) return undefined;
  return value;
}

export async function loginWithPrompts(kit: AuthKit, providerId?: string): Promise<StoredCredential | undefined> {
  const provider = providerId ? kit.getProvider(providerId) : await pickProvider(kit);
  if (!provider) return undefined;

  const method = await pickAuthMethod(provider);
  if (!method) return undefined;

  if (method === "api-key") {
    const value = await prompts.password({
      message: `Enter ${provider.name} API key`,
      validate: (input) => (input && input.trim().length > 0 ? undefined : "API key is required")
    });
    if (isCancel(value)) return undefined;
    return kit.saveApiKey(provider.id, value);
  }

  if (method === "env") {
    const value = await prompts.select({
      message: "Select env var",
      options: provider.envVars.map((envVar) => ({ value: envVar, label: envVar }))
    });
    if (isCancel(value)) return undefined;
    return kit.saveEnvCredential(provider.id, value);
  }

  if (method === "oauth-external") {
    prompts.log.info("External OAuth adapter placeholder saved. Wire pi-ai or provider CLI adapter here.");
    return kit.saveExternalOAuth(provider.id, { adapter: "external" });
  }

  return kit.saveNoAuth(provider.id);
}
