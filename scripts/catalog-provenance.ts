import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NormalizedCatalogSchema } from "../src/catalog-normalize.js";
import { CatalogProvenanceSchema, ReleaseCatalogProvenanceSchema } from "../src/catalog-source-schema.js";

const PROVENANCE_PATH = "generated/catalog-provenance.json";
const SNAPSHOT_PATH = "generated/catalog-snapshot.json";
const SOURCE_PATH = "test/fixtures/models-dev/models-dev-api-full.json";

export type CatalogVerification = {
  readonly modelCount: number;
  readonly normalizedContentSha256: string;
  readonly providerCount: number;
  readonly sourceContentSha256: string;
};

class CatalogProvenanceError extends Error {
  readonly name = "CatalogProvenanceError";
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) throw new CatalogProvenanceError(`invalid JSON: ${path}`);
    throw error;
  }
}

function modelCount(providers: readonly { readonly models: readonly unknown[] }[]): number {
  return providers.reduce((total, provider) => total + provider.models.length, 0);
}

export async function validateGeneratedCatalog(root: string, validateSource: boolean): Promise<CatalogVerification> {
  const [provenanceText, snapshotText] = await Promise.all([
    readFile(join(root, PROVENANCE_PATH), "utf8"),
    readFile(join(root, SNAPSHOT_PATH), "utf8"),
  ]);
  const provenance = ReleaseCatalogProvenanceSchema.parse(parseJson(provenanceText, PROVENANCE_PATH));
  const snapshot = NormalizedCatalogSchema.parse(parseJson(snapshotText, SNAPSHOT_PATH));
  const embeddedProvenance = CatalogProvenanceSchema.parse(snapshot.provenance);
  if (JSON.stringify(CatalogProvenanceSchema.parse(provenance)) !== JSON.stringify(embeddedProvenance)) {
    throw new CatalogProvenanceError("snapshot provenance does not match release provenance");
  }
  const normalizedContentSha256 = sha256(snapshotText.trimEnd());
  if (provenance.normalizedContentSha256 !== normalizedContentSha256) {
    throw new CatalogProvenanceError("normalized snapshot hash mismatch");
  }
  const providers = snapshot.providers;
  const models = modelCount(providers);
  if (provenance.providerCount !== providers.length || provenance.modelCount !== models) {
    throw new CatalogProvenanceError("catalog count mismatch");
  }
  if (validateSource) {
    const sourceContentSha256 = sha256(await readFile(join(root, SOURCE_PATH)));
    if (provenance.sourceContentSha256 !== sourceContentSha256) {
      throw new CatalogProvenanceError("catalog source hash mismatch");
    }
  }
  return {
    modelCount: models,
    normalizedContentSha256,
    providerCount: providers.length,
    sourceContentSha256: provenance.sourceContentSha256,
  };
}
