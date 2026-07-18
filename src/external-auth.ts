import type { ProviderDefinition } from "./types.js";

export const CLIPROXYAPI_BASE_URL = "http://localhost:8317";

const cliProxyApiProviders = new Set(["anthropic", "google"]);
const accountOAuthProviders = new Set(["openai", "github-copilot"]);

export type ExternalAuthMetadata = Readonly<Record<string, string>> & {
  readonly adapter: "cliproxyapi";
  readonly provider: "anthropic" | "google";
  readonly baseUrl: typeof CLIPROXYAPI_BASE_URL;
  readonly warningAccepted: "true";
  readonly cliProxyApiPath?: string;
};

function normalizeProviderId(provider: ProviderDefinition | string): string {
  return typeof provider === "string" ? provider.trim().toLowerCase() : provider.id;
}

export function isCliProxyApiProvider(provider: ProviderDefinition | string): boolean {
  return cliProxyApiProviders.has(normalizeProviderId(provider));
}

export function isAccountOAuthProvider(provider: ProviderDefinition | string): boolean {
  return accountOAuthProviders.has(normalizeProviderId(provider));
}

export function isExternalOAuthProvider(provider: ProviderDefinition | string): boolean {
  return isCliProxyApiProvider(provider) || isAccountOAuthProvider(provider);
}

export function getExternalAuthMetadata(
  provider: ProviderDefinition | string,
  options: {
    readonly cliProxyApiPath?: string;
  } = {}
): ExternalAuthMetadata | undefined {
  const providerId = normalizeProviderId(provider);
  if (providerId !== "anthropic" && providerId !== "google") return undefined;
  return {
    adapter: "cliproxyapi",
    provider: providerId,
    baseUrl: CLIPROXYAPI_BASE_URL,
    warningAccepted: "true",
    ...(options.cliProxyApiPath ? { cliProxyApiPath: options.cliProxyApiPath } : {})
  };
}

export function getCliProxyApiLabel(provider: ProviderDefinition): string {
	switch (provider.id) {
		case "anthropic":
			return "Sign in with Claude (use at your own risk)";
		case "google":
			return "Sign in with Gemini (use at your own risk)";
		default:
			return "Sign in (use at your own risk)";
	}
}

export function getCliProxyApiWarning(provider: ProviderDefinition): string {
  const product = provider.id === "anthropic" ? "Claude" : "Gemini";
  return `${product} via CLIProxyAPI uses external/unofficial account-routing flows. It may violate provider terms and can get your account blocked or limited. Continue only if you accept that risk. ai-auth-kit will provision local CLIProxyAPI access for ${CLIPROXYAPI_BASE_URL} on first use when needed.`;
}
