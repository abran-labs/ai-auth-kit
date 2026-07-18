import { getAuthPolicy } from "./auth-policy-registry.js";
import type { NormalizedCatalog } from "./catalog-normalize.js";
import type { ModelDefinition, ProviderDefinition } from "./types.js";

const AUTH_ORDER = ["api-key", "oauth-external", "env", "none"] as const;

const COMPATIBILITY_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "ollama",
    name: "Ollama",
    envVars: ["OLLAMA_API_KEY"],
    authMethods: ["none", "env"],
    docsUrl: "https://ollama.com",
    models: [{ id: "llama3.2", name: "Llama 3.2" }, { id: "qwen2.5-coder", name: "Qwen 2.5 Coder" }],
  },
];

function modelTags(model: NormalizedCatalog["providers"][number]["models"][number]): readonly string[] {
  return [model.status, ...(model.reasoning ? ["reasoning"] : []), ...(model.tools ? ["tools"] : []), ...(model.structuredOutput ? ["structured-output"] : [])];
}

function orderedAuthMethods(methods: readonly ProviderDefinition["authMethods"][number][]): ProviderDefinition["authMethods"] {
  return [...methods].sort((left, right) => AUTH_ORDER.indexOf(left) - AUTH_ORDER.indexOf(right));
}

export function providersFromCatalog(catalog: NormalizedCatalog): readonly ProviderDefinition[] {
  const providers = catalog.providers.map((provider) => {
    const policy = getAuthPolicy(provider.id, provider.envNames);
    return {
      id: provider.id,
      name: provider.name,
      envVars: policy.envNames,
      authMethods: orderedAuthMethods(policy.methods),
      ...(provider.docsUrl === undefined ? {} : { docsUrl: provider.docsUrl }),
      models: provider.models
        .filter((model) => model.status !== "deprecated")
        .map((model): ModelDefinition => ({
          id: model.id,
          name: model.name,
          ...(model.limits?.context === undefined ? {} : { contextWindow: model.limits.context }),
          tags: modelTags(model),
        })),
    };
  }).filter((provider) => provider.authMethods.length > 0);
  const knownIds = new Set(providers.map((provider) => provider.id));
  return [...providers, ...COMPATIBILITY_PROVIDERS.filter((provider) => !knownIds.has(provider.id))];
}
