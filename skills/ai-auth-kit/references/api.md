# Public API — 1.0.0

Import only from `@abran-labs/ai-auth-kit`. Internal file paths are not compatibility surfaces.

## Complete root export inventory

- Catalog: `DEFAULT_PROVIDERS`, `CatalogRuntime`, `CatalogRefreshOptions`,
  `CatalogRuntimeOptions`, `CatalogStatus`.
- Account OAuth: `AccountOAuthDeps`, `AccountOAuthLoginPrompts`,
  `loginAccountOAuthProvider`, `loginGitHubCopilotAccount`, `loginOpenAiAccount`,
  `loginChatGptPlan`, `signOutChatGptPlan`, `ChatGptPlanLoginDeps`, `ChatGptPlanLoginPrompts`,
  `ChatGptPlanSignOutResult`.
- CLIProxyAPI: `CLIPROXYAPI_LATEST_RELEASE_URL`, `CLIPROXYAPI_REPO`,
  `CliProxyApiLoginDeps`, `CliProxyApiLoginResult`, `CliProxyApiProvisionDeps`,
  `CliProxyApiProvisionResult`, `provisionCliProxyApi`, `provisionCliProxyApiForProvider`,
  `runCliProxyApiLogin`.
- External auth: `CLIPROXYAPI_BASE_URL`, `getCliProxyApiLabel`, `getCliProxyApiWarning`,
  `getExternalAuthMetadata`, `isAccountOAuthProvider`, `isCliProxyApiProvider`,
  `isExternalOAuthProvider`.
- Hosted CLIProxyAPI: `CLIPROXY_CALLBACK_PREFIX`, `createCliProxyAccountConnector`,
  `defaultCliProxyRoutePrefix`, `getCliProxyHostedWarning`, `CliProxyAccountConnectorOptions`,
  `CliProxyAccountProvider`, `CliProxyManagementError`, `createCliProxyManagementClient`,
  `CliProxyAuthUrl`, `CliProxyCredentialFile`, `CliProxyCredentialModel`,
  `CliProxyManagementClient`, `CliProxyManagementErrorCode`, `CliProxyManagementFetch`,
  `CliProxyManagementOptions`, `CliProxyOAuthStatusResult`, `renderCliProxyServerConfig`,
  `CliProxyServerConfigOptions`.
- Kit: `AuthKit`, `createAuthKit`, `createProjectAuthKit`.
- Hosted connect: `createConnectService`, `ConnectService`, `ConnectServiceOptions`,
  `ChatGptPlanHostOptions`, `ApiKeyVerdict`, `ReportFailure`, `HostedTenantStore`,
  `PendingFlowStore`, `createMemoryTenantStore`, `createMemoryPendingFlowStore`.
- Picker: `confirmExternalOAuthWarning`, `ConfirmPromptAdapter`, `EnvMap`, `getAuthMethodHint`, `getAuthMethodLabel`,
  `getOAuthMethodLabel`, `LoginWithPromptsOptions`, `loginWithPrompts`, `PromptAdapter`,
  `pickAuthMethod`, `pickModel`, `pickProvider`.
- ChatGPT plan: `CHATGPT_AUTHORIZE_URL`, `CHATGPT_TOKEN_URL`, `CHATGPT_REVOKE_URL`,
  `CHATGPT_PLAN_RESOURCE`, `CHATGPT_PLAN_SCOPE`, `CHATGPT_PLAN_SCOPES`,
  `CHATGPT_DYNAMIC_CLIENT_ID`, `CHATGPT_CALLBACK_PATH`, `CHATGPT_DEFAULT_CALLBACK_PORT`,
  `CHATGPT_ISSUER`, `CHATGPT_JWKS_URL`, `CHATGPT_PLAN_ADAPTER`, `CLIPROXYAPI_ACCOUNT_ADAPTER`,
  `CHATGPT_PLAN_REFRESH_WINDOW_MS`, `CHATGPT_PLAN_MODELS_URL`, `ChatGptPlanError`, `ChatGptPlanErrorCode`,
  `ChatGptIdentity`, `ChatGptIdTokenCheck`, `createChatGptHostId`, `isChatGptHostId`,
  `startChatGptAuthorization`, `parseChatGptCallback`, `exchangeChatGptCode`,
  `refreshChatGptTokens`, `revokeChatGptSession`, `verifyChatGptIdToken`,
  `planNotGrantedCause`, `ChatGptPlanNotGrantedCause`, `ChatGptAuthorization`, `ChatGptAuthorizationRequest`,
  `ChatGptCallbackResult`, `ChatGptPlanTokens`, `ChatGptSignIn`, `ChatGptExchangeInput`,
  `ChatGptRefreshInput`, `ChatGptPendingAuthorization`, `chatGptPlanSecretRefs`,
  `chatGptPlanMetadata`, `chatGptPlanDisabledMetadata`, `ChatGptPlanDisabledRegistration`,
  `parseChatGptPlanMetadata`, `ChatGptPlanSecretRefs`,
  `ChatGptPlanMetadata`, `ensureChatGptPlanAccess`, `isSameChatGptGeneration`,
  `ChatGptPlanRefreshContext`, `ChatGptPlanTokenWrite`, `ChatGptPlanLock`,
  `ChatGptPlanAccess`, `listChatGptPlanModels`, `ChatGptPlanModelsInput`,
  `startChatGptLoopback`, `ChatGptLoopback`, `ChatGptCallbackOutcome`.
- Storage: `emptyState`, `FileAuthKitStore`, `FileSecretStore`, `globalConfigDir`,
  `globalStorage`, `projectConfigDir`, `projectStorage`.
- Definitions: `ApiKeyCredential`, `AuthKitOptions`, `AuthKitState`, `AuthKitStorage`,
  `AuthKitStore`, `AuthMethod`, `EnvCredential`, `ExternalOAuthCredential`, `ModelDefinition`,
  `NoAuthCredential`, `ProjectStorageOptions`, `ProviderDefinition`, `ResolvedSelection`,
  `RuntimeAuth`, `RuntimeExternalOAuth`, `RuntimePlanUsage`, `SecretStore`, `SelectedModel`,
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

## Hosted connect

```ts
createConnectService(options: ConnectServiceOptions): ConnectService;
```

`handle(tenantId, request)` speaks the browser connect protocol (`providers`, `status`, `start`,
`submit`, `poll`, `cancel`, `models`, `select-model`, `disconnect`) and never throws for expected
failures. `runtime(tenantId)` resolves the tenant selection into wire details for inference.
`reportFailure(tenantId, failure)` marks health (`auth_revoked`, `plan_limit`, `not_eligible`).
`dispose()` stops shared catalog refresh. Hosts supply `HostedTenantStore` (isolated storage per
tenant) and `PendingFlowStore` (durable short-lived flows); memory fakes cover tests. API-key
methods are offered only for reviewed base URLs; ChatGPT plan needs `chatGptPlan.enabled`.

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

`PromptAdapter` supplies `isCancel`, `autocomplete`, `select`, `confirm`, `password`,
optional `text` (manual redirect-URL paste for headless sessions), and `info`.
`LoginWithPromptsOptions` may override CLIProxyAPI provision/login functions and inject
`accountOAuthDeps` or `chatGptPlanDeps` for host boundaries/tests.

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

## Sign in with ChatGPT

- OpenAI account login defaults to `loginChatGptPlan`: loopback callback on
  `127.0.0.1:1455` then `1457` raced with an optional `text` paste prompt, then
  `exchangeChatGptCode` with ID-token verification. Failures report through `info`
  and rethrow `ChatGptPlanError`; nothing is saved.
- Re-login reuses the issued `clientId` and saved email from the
  `openai-chatgpt-plan` credential. The per-host id persists under
  `host:chatgpt:ext-agent-host-id` and survives secret reconcile.
- Re-login sends the stored ID token as `id_token_hint` (redacted from CLI output).
  A declined plan scope keeps the registration with `planUsage: "disabled"` and
  `health: "reconnect-required"` (no tokens) so the next attempt re-consents with the
  issued `clientId`.
- Hosted `models` for plan connections lists the account catalog via
  `listChatGptPlanModels` (`GET https://api.openai.com/v1/models`, `visibility: "list"`,
  server order), falling back to the catalog heuristic when unreachable.
- Runtime auth refreshes through `ensureChatGptPlanAccess` and returns
  `adapter: "openai-chatgpt-plan"` with `baseUrl: "https://api.openai.com/v1"`,
  plus `health: "reconnect-required"` and `planUsage` (`kind: "chatgpt-plan"`,
  `requestRules: "responses-store-false-stream-true"`) when reconnect is needed.
- Plan requests must use the Responses API with `store: false`, `stream: true`.
- `signOutChatGptPlan` revokes the refresh token best-effort, clears token secrets,
  keeps `clientId` for re-login, and reports `{ remoteRevocationConfirmed }`.
- Legacy Codex-CLI `loginOpenAiAccount` stays exported but is not offered by the picker.

## Hosted CLIProxyAPI exports

- Connector: `createCliProxyAccountConnector` (stateless per-tenant Claude account flows:
  `start` snapshots credentials and returns an authorization URL plus an opaque session;
  `submitCallback` posts the pasted `http://localhost:54545/callback` URL;
  `poll` prefix-pins the new credential file and returns the binding, or `account_in_use`
  when the same Claude account is already connected). Helpers `defaultCliProxyRoutePrefix`,
  `getCliProxyHostedWarning`, constant `CLIPROXY_CALLBACK_PREFIX`, contracts
  `CliProxyAccountConnectorOptions` and `CliProxyAccountProvider`.
- Management client: `createCliProxyManagementClient` for `/v8/management` OAuth, credential,
  and model endpoints; typed `CliProxyManagementError` (`CliProxyManagementErrorCode`);
  contracts `CliProxyManagementOptions`, `CliProxyManagementFetch`, `CliProxyManagementClient`,
  `CliProxyAuthUrl`, `CliProxyOAuthStatusResult`, `CliProxyCredentialFile`, and
  `CliProxyCredentialModel`.
- Server config: `renderCliProxyServerConfig` renders a hardened v8 YAML config
  (localhost bind, local-only management, tenant client keys, `force-model-prefix`);
  contract `CliProxyServerConfigOptions`.

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
- Runtime: `RuntimeAuth`, `RuntimeExternalOAuth`, `RuntimePlanUsage`.
