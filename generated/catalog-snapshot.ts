import { NormalizedCatalogSchema, type NormalizedCatalog } from "../src/catalog-normalize.js";
import { CatalogProvenanceSchema, type CatalogProvenance } from "../src/catalog-source-schema.js";

export const SNAPSHOT_PROVENANCE: CatalogProvenance = CatalogProvenanceSchema.parse(await Bun.file(new URL("./catalog-provenance.json", import.meta.url)).json());
export const SNAPSHOT_CATALOG: NormalizedCatalog = NormalizedCatalogSchema.parse(await Bun.file(new URL("./catalog-snapshot.json", import.meta.url)).json());
