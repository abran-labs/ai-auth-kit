import { readFile } from "node:fs/promises";
import { NormalizedCatalogSchema } from "./catalog-normalize.js";
const snapshotUrl = new URL("../generated/catalog-snapshot.json", import.meta.url);
export const SNAPSHOT_CATALOG = NormalizedCatalogSchema.parse(JSON.parse(await readFile(snapshotUrl, "utf8")));
//# sourceMappingURL=catalog-snapshot.js.map