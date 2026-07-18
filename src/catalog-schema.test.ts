import { expect, test } from "bun:test";

import { NormalizedCatalogSchema, normalizeModelsDevCatalog } from "./catalog-normalize.js";
import { ModelsDevSourceSchema } from "./catalog-source-schema.js";
import { SNAPSHOT_CATALOG, SNAPSHOT_PROVENANCE } from "../generated/catalog-snapshot.js";

test("normalizes pinned Models.dev fixture deterministically", async () => {
  // Given: a pinned subset of the official Models.dev response and capture provenance.
  const source: unknown = await Bun.file("test/fixtures/models-dev/pinned-api-subset.json").json();
  const provenance: unknown = await Bun.file("test/fixtures/models-dev/provenance.json").json();
  const golden = NormalizedCatalogSchema.parse(await Bun.file("test/fixtures/models-dev/normalized-golden.json").json());

  // When: the inert source boundary is normalized twice.
  const first = normalizeModelsDevCatalog(source, provenance);
  const second = normalizeModelsDevCatalog(source, provenance);

  // Then: output is stable, golden, and contains no remote transport metadata.
  expect(first).toEqual(golden);
  expect(second).toEqual(first);
  expect(JSON.stringify(first)).not.toContain("x-remote");
  expect(JSON.stringify(first)).not.toContain("reasoning\":{\"mode\":\"pro");
});

test("covers every provider and model in the pinned full Models.dev fixture", async () => {
  // Given: the complete official capture and its immutable provenance.
  const source: unknown = await Bun.file("test/fixtures/models-dev/models-dev-api-full.json").json();
  const provenance: unknown = await Bun.file("test/fixtures/models-dev/models-dev-api-full-provenance.json").json();
  const golden = NormalizedCatalogSchema.parse(await Bun.file("test/fixtures/models-dev/models-dev-normalized-full.json").json());

  // When: every source record is parsed and normalized.
  const parsed = ModelsDevSourceSchema.safeParse(source);
  const catalog = normalizeModelsDevCatalog(source, provenance);
  const sourceProviderCount = parsed.success ? Object.keys(parsed.data).length : 0;
  const sourceModelCount = parsed.success ? Object.values(parsed.data).reduce((total, provider) => total + Object.keys(provider.models).length, 0) : 0;
  const modelCount = catalog.providers.reduce((total, provider) => total + provider.models.length, 0);

  // Then: all official records survive deterministically with known/new sentinels.
  expect(parsed.success).toBe(true);
  expect(sourceProviderCount).toBe(167);
  expect(sourceModelCount).toBe(5693);
  expect(catalog).toEqual(golden);
  expect(catalog.providers).toHaveLength(167);
  expect(modelCount).toBe(5693);
  expect(catalog.providers.some((provider) => provider.id === "openai" && provider.models.some((model) => model.id === "gpt-5.6-terra"))).toBe(true);
  expect(catalog.providers.some((provider) => provider.id === "qiniu-ai" && provider.models.some((model) => model.id === "kling-v2-6"))).toBe(true);
  expect(catalog.providers.some((provider) => provider.id === "cloudflare-workers-ai" && provider.models.some((model) => model.id === "@cf/meta/llama-3.2-1b-instruct"))).toBe(true);
});

test("generates the full offline snapshot from the strict pinned transform", async () => {
  // Given: the generated snapshot and the pinned full normalization golden data.
  const golden = NormalizedCatalogSchema.parse(await Bun.file("test/fixtures/models-dev/models-dev-normalized-full.json").json());

  // When: generated runtime data is loaded.
  const models = SNAPSHOT_CATALOG.providers.reduce((total, provider) => total + provider.models.length, 0);

  // Then: it is exact full fixture content with pinned provenance.
  expect(SNAPSHOT_CATALOG).toEqual(golden);
  expect(SNAPSHOT_PROVENANCE.sourceContentSha256).toBe("e38484e40478b751cf89099c336ef05fcab66d4313cf47865d639855c6f277ec");
  expect(models).toBe(5693);
});
