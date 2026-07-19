# Public API — 1.0.0

Import only from `@abran-labs/ai-auth-kit`. Internal file paths are not compatibility surfaces.

## Complete root export inventory

- Catalog: `DEFAULT_PROVIDERS`, `CatalogRuntime`, `CatalogRefreshOptions`,
  `CatalogRuntimeOptions`, `CatalogStatus`.
- Account OAuth: `AccountOAuthDeps`, `AccountOAuthLoginPrompts`,
  `loginAccountOAuthProvider`, `loginGitHubCopilotAccount`, `loginOpenAiAccount`.
- CLIProxyAPI: `CLIPROXYAPI_LATEST_RELEASE_URL`, `CLIPROXYAPI_REPO`,
  `CliProxyApiLoginDeps`, `CliProxyApiLoginResult`, `CliProxyApiProvisionDeps`,
  `CliProxyApiProvisionResult`, `provisionCliProxyApi`, `provisionCliProxyApiForProvider`,
  `runCliProxyApiLogin`.
- External auth: `CLIPROXYAPI_BASE_URL`, `getCliProxyApiLabel`, `getCliProxyApiWarning`,
  `getExternalAuthMetadata`, `isAccountOAuthProvider`, `isCliProxyApiProvider`,
  `isExternalOAuthProvider`.
- Kit: `AuthKit`, `createAuthKit`, `createProjectAuthKit`.
- Picker: `confirmExternalOAuthWarning`, `getAuthMethodHint`, `getAuthMethodLabel`,
  `getOAuthMethodLabel`, `LoginWithPromptsOptions`, `loginWithPrompts`, `PromptAdapter`,
  `pickAuthMethod`, `pickModel`, `pickProvider`.
- Storage: `emptyState`, `FileAuthKitStore`, `FileSecretStore`, `globalConfigDir`,
  `globalStorage`, `projectConfigDir`, `projectStorage`.
- Definitions: `ApiKeyCredential`, `AuthKitOptions`, `AuthKitState`, `AuthKitStorage`,
  `AuthKitStore`, `AuthMethod`, `EnvCredential`, `ExternalOAuthCredential`, `ModelDefinition`,
  `NoAuthCredential`, `ProjectStorageOptions`, `ProviderDefinition`, `ResolvedSelection`,
  `RuntimeAuth`, `RuntimeExternalOAuth`, `SecretStore`, `SelectedModel`,
  `SelectedModelSnapshot`, `StoredCredential`.

## Factories

```ts
createProjectAuthKit(
  projectName: string,
  options?: ProjectStorageOptions & Pick<AuthKitOptions, "providers" | "catalog">,
): AuthKit;

createAuthKit(options: AuthKitOptions): AuthKit;
projectStorage(projectName: string, options?: ProjectStorageOptions): AuthKitStorage;
globalStorage(appName?: string): AuthKitStorage;
```

`createProjectAuthKit()` defaults to project storage and managed catalog refresh. Passing explicit
`providers` disables managed catalog refresh. `createAuthKit()` accepts explicit storage and
optional provider/catalog configuration.

## `AuthKit`

| Method | Contract |
| --- | --- |
| `ready()` | Refresh managed catalog; return `CatalogStatus` when present. |
| `refreshCatalog({ force? })` | Refresh now; force bypasses normal five-minute guard. |
| `catalogStatus()` | Current source/cache/snapshot status. |
| `startCatalogRefresh()` / `dispose()` | Start hourly attempts / stop timer. |
| `listProviders()` / `getProvider(id)` | Read provider definitions. |
| `listModels(providerId)` / `getModel(providerId, modelId)` | Read models. |
| `readState()` | Read state and reconcile stale secret refs. |
| `saveApiKey(providerId, apiKey)` | Store trimmed secret separately; save reference metadata. |
| `saveEnvCredential(providerId, envVar?)` | Save variable name only. |
| `saveExternalOAuth(providerId, metadata?)` | Save locally allowed external-auth metadata. |
| `saveNoAuth(providerId)` | Save no-auth credential where policy allows. |
| `getCredential()` / `removeCredential()` | Read/remove provider credential. |
| `selectModel(providerId, modelId)` | Save selection plus immutable provider/model snapshot. |
| `getSelectedModel()` | Return saved model state. |
| `resolveSelection()` | Resolve live entry, else valid saved snapshot. |
| `runtimeAuth(providerId)` | Resolve provider-scoped env/external auth; does not send requests. |

## Picker exports

```ts
pickProvider(kit, message?, promptAdapter?): Promise<ProviderDefinition | undefined>;
pickModel(kit, providerId, message?, promptAdapter?): Promise<ModelDefinition | undefined>;
pickAuthMethod(provider, promptAdapter?, env?): Promise<AuthMethod | undefined>;
loginWithPrompts(
  kit,
  providerId?,
  promptAdapter?,
  options?,
): Promise<StoredCredential | undefined>;
```

`PromptAdapter` supplies `isCancel`, `autocomplete`, `select`, `confirm`, `password`, and `info`.
`LoginWithPromptsOptions` may override CLIProxyAPI provision/login functions and inject
`accountOAuthDeps` for host boundaries/tests.

## OAuth and CLIProxyAPI exports

- Account: `loginAccountOAuthProvider`, `loginOpenAiAccount`, `loginGitHubCopilotAccount`, plus
  dependency contracts `AccountOAuthDeps` and `AccountOAuthLoginPrompts`.
- Optional adapter: `provisionCliProxyApi`, `provisionCliProxyApiForProvider`,
  `runCliProxyApiLogin`; constants `CLIPROXYAPI_LATEST_RELEASE_URL`, `CLIPROXYAPI_REPO`, and
  `CLIPROXYAPI_BASE_URL`; contracts `CliProxyApiLoginDeps`, `CliProxyApiLoginResult`,
  `CliProxyApiProvisionDeps`, and `CliProxyApiProvisionResult`.
- Classification/labels: `isAccountOAuthProvider`, `isCliProxyApiProvider`,
  `isExternalOAuthProvider`, `getExternalAuthMetadata`, `getCliProxyApiWarning`, and
  `getCliProxyApiLabel`.

## Picker labels and warning

- `confirmExternalOAuthWarning` performs the explicit CLIProxyAPI risk confirmation.
- `getAuthMethodLabel` and `getAuthMethodHint` describe locally allowed methods.
- `getOAuthMethodLabel` describes provider-specific account login.

## Catalog/storage exports

- `CatalogRuntime`, `DEFAULT_PROVIDERS`, `CatalogRefreshOptions`, `CatalogRuntimeOptions`, and
  `CatalogStatus`.
- `FileAuthKitStore`, `FileSecretStore`, `projectConfigDir`, `globalConfigDir`, `emptyState`.

## Public types

- Definitions: `AuthMethod`, `ProviderDefinition`, `ModelDefinition`.
- Credentials: `ApiKeyCredential`, `EnvCredential`, `ExternalOAuthCredential`,
  `NoAuthCredential`, `StoredCredential`.
- State: `AuthKitState`, `SelectedModel`, `SelectedModelSnapshot`, `ResolvedSelection`.
- Storage: `AuthKitStore`, `SecretStore`, `AuthKitStorage`, `ProjectStorageOptions`,
  `AuthKitOptions`.
- Runtime: `RuntimeAuth`, `RuntimeExternalOAuth`.
