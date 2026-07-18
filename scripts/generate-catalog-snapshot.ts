import { createHash } from "node:crypto";

import { normalizeModelsDevCatalog } from "../src/catalog-normalize.js";

const sourcePath = "test/fixtures/models-dev/models-dev-api-full.json";
const provenancePath = "test/fixtures/models-dev/models-dev-api-full-provenance.json";
const snapshotPath = "generated/catalog-snapshot.json";
const outputProvenancePath = "generated/catalog-provenance.json";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const source: unknown = await Bun.file(sourcePath).json();
const provenance: unknown = await Bun.file(provenancePath).json();
const catalog = normalizeModelsDevCatalog(source, provenance);
const normalized = `${JSON.stringify(catalog)}\n`;
const normalizedSha = sha256(normalized.trimEnd());
const sourceText = await Bun.file(sourcePath).text();
const sourceSha = sha256(sourceText);
if (catalog.provenance.sourceContentSha256 !== sourceSha) throw new Error("Pinned source hash mismatch");
await Bun.write(snapshotPath, normalized);
await Bun.write(outputProvenancePath, `${JSON.stringify({ ...catalog.provenance, normalizedContentSha256: normalizedSha, providerCount: catalog.providers.length, modelCount: catalog.providers.reduce((total, provider) => total + provider.models.length, 0) }, null, 2)}\n`);
