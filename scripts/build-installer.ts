import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReleaseManifest } from "./release-artifacts.js";

const root = resolve(import.meta.dirname, "..");

function manager(manifest: ReleaseManifest, arch: "x64" | "arm64"): { readonly filename: string; readonly sha256: string } {
  const target = manifest.artifacts.find((artifact) => artifact.target === `manager-${arch}-musl`);
  if (target === undefined) throw new Error(`manifest has no static ${arch} manager`);
  return target;
}

export async function renderInstaller(manifest: ReleaseManifest): Promise<string> {
  const [x64, arm64, template] = await Promise.all([Promise.resolve(manager(manifest, "x64")), Promise.resolve(manager(manifest, "arm64")), readFile(resolve(root, "install.sh.template"), "utf8")]);
  const base = `https://github.com/abran-labs/ai-auth-kit/releases/download/v${manifest.version}`;
  return template
    .replace("__AI_AUTH_KIT_MANAGER_X64_URL__", `${base}/${x64.filename}`)
    .replace("__AI_AUTH_KIT_MANAGER_ARM64_URL__", `${base}/${arm64.filename}`)
    .replace("__AI_AUTH_KIT_MANAGER_X64_SHA256__", x64.sha256)
    .replace("__AI_AUTH_KIT_MANAGER_ARM64_SHA256__", arm64.sha256);
}

async function manifest(path: string): Promise<ReleaseManifest> {
  return Bun.file(path).json() as Promise<ReleaseManifest>;
}

if (import.meta.main) {
  const manifestPath = process.argv[2] === "--check" ? resolve(root, "release", "manifest.json") : process.argv[2] ?? resolve(root, "release", "manifest.json");
  const expected = await renderInstaller(await manifest(manifestPath));
  const current = await readFile(resolve(root, "install.sh"), "utf8").catch(() => "");
  if (process.argv[3] === "--check" || process.argv[2] === "--check") {
    if (current !== expected) throw new Error("install.sh is stale; run bun run installer:build");
  } else if (process.argv.length === 2 || process.argv.length === 3) {
    await Bun.write(resolve(root, "install.sh"), expected);
  } else {
    throw new Error("usage: bun run installer:build [--check]");
  }
}
