---
title: Library API
description: Public factories, AuthKit methods, storage helpers, catalog runtime, and exported types.
---

Import every public symbol from `@abran-labs/ai-auth-kit`. Internal paths are not supported.

## Factories

| Export | Purpose |
| --- | --- |
| `createProjectAuthKit(projectName, options?)` | Create a kit with project-local storage. |
| `createAuthKit(options)` | Create a kit with explicit storage and optional providers/catalog. |
| `projectStorage(projectName, options?)` | Build project storage adapters. |
| `globalStorage(appName)` | Build opt-in XDG/global storage adapters. |

## `AuthKit` methods

| Method | Result |
| --- | --- |
| `ready()` | Refresh catalog and return catalog status when a runtime catalog exists. |
| `refreshCatalog(options?)` | Refresh now; `force` bypasses the normal guard. |
| `catalogStatus()` | Return current source/cache/snapshot status. |
| `startCatalogRefresh()` / `dispose()` | Start or stop hourly refresh attempts. |
| `listProviders()` / `getProvider(id)` | Read provider definitions. |
| `listModels(providerId)` / `getModel(providerId, modelId)` | Read model definitions. |
| `saveApiKey()` / `saveEnvCredential()` | Persist a supported credential choice. |
| `saveExternalOAuth()` / `saveNoAuth()` | Persist supported external or no-auth metadata. |
| `getCredential()` / `removeCredential()` | Read or remove provider credential state. |
| `selectModel()` / `getSelectedModel()` | Save or read the selected model. |
| `resolveSelection()` | Resolve current catalog data or the saved historical snapshot. |
| `runtimeAuth(providerId)` | Return provider ID, credential metadata, env values, and optional external auth. |

## Other export groups

- Picker helpers: `pickProvider`, `pickModel`, `pickAuthMethod`, `loginWithPrompts`.
- Account OAuth: `loginOpenAiAccount`, `loginGitHubCopilotAccount`,
  `loginAccountOAuthProvider`.
- CLIProxyAPI: provisioning and login helpers plus release/base URL constants.
- Catalog: `CatalogRuntime`, `DEFAULT_PROVIDERS`, status and option types.
- Storage: `FileAuthKitStore`, `FileSecretStore`, config-dir helpers, `emptyState`.
- Public models: provider, model, credential, selection, storage, and runtime-auth types.

See `src/index.ts` at the pinned commit for the exact export list.
