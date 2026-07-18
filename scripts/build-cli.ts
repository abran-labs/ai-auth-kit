import { mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export type BuildCliOptions = { readonly outputPath?: string; readonly releaseVersion?: string; readonly target?: "bun-linux-x64-baseline" | "bun-linux-x64-musl" | "bun-linux-arm64" | "bun-linux-arm64-musl" };

export function resolveReleaseVersion(packageVersion: string, releaseVersion?: string): string {
  if (!SEMVER.test(packageVersion)) throw new Error(`package version is malformed: ${packageVersion}`);
  if (releaseVersion === undefined) return packageVersion;
  const normalized = releaseVersion.startsWith("v") ? releaseVersion.slice(1) : releaseVersion;
  if (!SEMVER.test(normalized)) throw new Error(`release version is malformed: ${releaseVersion}`);
  if (normalized !== packageVersion) throw new Error(`release version ${releaseVersion} does not match package version ${packageVersion}`);
  return packageVersion;
}

async function packageVersion(): Promise<string> {
  const value: unknown = await Bun.file(join(root, "package.json")).json();
  if (typeof value !== "object" || value === null || !("version" in value) || typeof value.version !== "string") throw new Error("package.json contains no version");
  return value.version;
}

export async function buildCli(options: BuildCliOptions = {}): Promise<{ readonly outputPath: string; readonly version: string }> {
  const outputPath = resolve(options.outputPath ?? join(root, "build", "ai-auth-kit"));
  const version = resolveReleaseVersion(await packageVersion(), options.releaseVersion);
  const temporary = join(dirname(outputPath), `.${basename(outputPath)}.tmp-${process.pid}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await rm(temporary, { force: true });
  try {
    const compile = options.target === undefined
      ? { outfile: temporary, autoloadBunfig: false, autoloadDotenv: false, autoloadPackageJson: false, autoloadTsconfig: false }
      : { target: options.target, outfile: temporary, autoloadBunfig: false, autoloadDotenv: false, autoloadPackageJson: false, autoloadTsconfig: false };
    const result = await Bun.build({
      entrypoints: [join(root, "src", "cli.ts")],
      compile,
      define: { AI_AUTH_KIT_VERSION: JSON.stringify(version) },
      env: "disable",
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join("\n"));
    await rename(temporary, outputPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return { outputPath, version };
}
