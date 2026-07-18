import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type ReleaseManifest, verifyReleaseDirectory } from "./release-artifacts.js";
import { signBundle, unsignedBundle } from "./release-bundle.js";

async function main(): Promise<void> {
  const directory = resolve(process.argv[2] ?? "release");
  const signingKey = process.env.INSTALLER_MANAGER_SIGNING_KEY;
  if (signingKey === undefined || signingKey === "") throw new Error("INSTALLER_MANAGER_SIGNING_KEY is required from the protected release environment");
  const manifest = await verifyReleaseDirectory(directory);
  const manifestSha256 = new Bun.CryptoHasher("sha256").update(await readFile(join(directory, "manifest.json"))).digest("hex");
  const bundle = signBundle(unsignedBundle(manifest satisfies ReleaseManifest, manifestSha256), signingKey);
  await writeFile(join(directory, "installer-manager-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 });
}

if (import.meta.main) main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
