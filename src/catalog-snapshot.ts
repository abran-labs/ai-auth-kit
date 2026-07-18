import { readFile } from "node:fs/promises";
import { NormalizedCatalogSchema, type NormalizedCatalog } from "./catalog-normalize.js";

const snapshotUrl = new URL("../generated/catalog-snapshot.json", import.meta.url);

export const SNAPSHOT_CATALOG: NormalizedCatalog = NormalizedCatalogSchema.parse(
  JSON.parse(await readFile(snapshotUrl, "utf8")),
);
