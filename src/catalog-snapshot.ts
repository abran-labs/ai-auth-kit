import { NormalizedCatalogSchema, type NormalizedCatalog } from "./catalog-normalize.js";

const snapshotUrl = new URL("../generated/catalog-snapshot.json", import.meta.url);

export const SNAPSHOT_CATALOG: NormalizedCatalog = NormalizedCatalogSchema.parse(
  await Bun.file(snapshotUrl).json(),
);
