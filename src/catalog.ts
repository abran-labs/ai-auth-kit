import { providersFromCatalog } from "./catalog-adapter.js";
import { SNAPSHOT_CATALOG } from "./catalog-snapshot.js";
import type { ProviderDefinition } from "./types.js";

export const DEFAULT_PROVIDERS: readonly ProviderDefinition[] = providersFromCatalog(SNAPSHOT_CATALOG);
