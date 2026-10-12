import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("Given the Node runtime, when the built refresher fetches a fresh catalog, then the network result is used", async () => {
  // Given: the built library under Node with an isolated cache and a local fresh source.
  const root = await mkdtemp(join(tmpdir(), "auth-kit-node-refresh-"));
  const dist = join(process.cwd(), "dist");
  const script = `
    import { createCatalogRefresher } from ${JSON.stringify(join(dist, "catalog-refresh.js"))};
    import { SNAPSHOT_CATALOG } from ${JSON.stringify(join(dist, "catalog-snapshot.js"))};
    const source = { provider: { id: "provider", name: "Provider", env: ["PROVIDER_API_KEY"], models: { "new-model": { id: "new-model", name: "New Model" } } } };
    const fetch = async () => new Response(JSON.stringify(source), { headers: { etag: '"N"' } });
    const refresher = createCatalogRefresher({ cacheRoot: ${JSON.stringify(root)}, fetch, sourceSchemaCommit: "800bbc1253753b9ac6675e9b2a123877c3dc5b80", snapshot: SNAPSHOT_CATALOG });
    process.stdout.write((await refresher.refresh()).source);
  `;
  try {
    // When: Node refreshes the catalog.
    const child = Bun.spawn({ cmd: ["node", "--input-type=module", "-e", script], stdout: "pipe", stderr: "pipe" });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);

    // Then: the fresh network catalog is accepted instead of silently falling back.
    expect(code, stderr).toBe(0);
    expect(stdout).toBe("network");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
