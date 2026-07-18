export { DEFAULT_PROVIDERS } from "./catalog.js";
export { CatalogRuntime, type CatalogRefreshOptions, type CatalogRuntimeOptions, type CatalogStatus } from "./catalog-runtime.js";
export {
  type AccountOAuthDeps,
  type AccountOAuthLoginPrompts,
  loginAccountOAuthProvider,
  loginGitHubCopilotAccount,
  loginOpenAiAccount,
} from "./account-oauth.js";
export {
	CLIPROXYAPI_LATEST_RELEASE_URL,
	CLIPROXYAPI_REPO,
	type CliProxyApiLoginDeps,
	type CliProxyApiLoginResult,
	type CliProxyApiProvisionDeps,
	type CliProxyApiProvisionResult,
	provisionCliProxyApi,
	provisionCliProxyApiForProvider,
	runCliProxyApiLogin,
} from "./cliproxyapi.js";
export {
	CLIPROXYAPI_BASE_URL,
	getCliProxyApiLabel,
	getCliProxyApiWarning,
	getExternalAuthMetadata,
	isAccountOAuthProvider,
	isCliProxyApiProvider,
	isExternalOAuthProvider,
} from "./external-auth.js";
export { AuthKit, createAuthKit, createProjectAuthKit } from "./kit.js";
export {
	confirmExternalOAuthWarning,
	getAuthMethodHint,
	getAuthMethodLabel,
	getOAuthMethodLabel,
	type LoginWithPromptsOptions,
	loginWithPrompts,
	type PromptAdapter,
	pickAuthMethod,
	pickModel,
	pickProvider,
} from "./picker.js";
export {
	emptyState,
	FileAuthKitStore,
	FileSecretStore,
	globalConfigDir,
	globalStorage,
	projectConfigDir,
	projectStorage,
} from "./storage.js";
export type {
	ApiKeyCredential,
	AuthKitOptions,
	AuthKitState,
	AuthKitStorage,
	AuthKitStore,
	AuthMethod,
	EnvCredential,
	ExternalOAuthCredential,
	ModelDefinition,
	NoAuthCredential,
	ProjectStorageOptions,
	ProviderDefinition,
	ResolvedSelection,
	RuntimeAuth,
	RuntimeExternalOAuth,
	SecretStore,
	SelectedModel,
	SelectedModelSnapshot,
	StoredCredential,
} from "./types.js";
