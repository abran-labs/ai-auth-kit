import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";

const root = process.cwd();
const packedConsumerEvidence = ".omo/evidence/packed-library-consumer-verification";

test("Given the package verifier evidence directory, when the npm release workflow stages the verified artifact, then it consumes that exact directory", async () => {
  const [verifier, workflow] = await Promise.all([
    readFile(join(root, "scripts", "pack-verify.ts"), "utf8"),
    readFile(join(root, ".github", "workflows", "npm-release.yml"), "utf8"),
  ]);

  expect(verifier).toContain(`const EVIDENCE_DIRECTORY = "${packedConsumerEvidence}"`);
  expect(workflow).toContain(`evidence='${packedConsumerEvidence}'`);
});
