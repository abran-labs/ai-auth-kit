import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { buildCli, resolveReleaseVersion } from "./build-cli.js";
import { canonicalReleaseTargets, createReleaseManifest, serializeChecksums, serializeManifest } from "./release-artifacts.js";
import { buildInstallerManagers } from "./build-installer-manager.js";
import { renderInstaller } from "./build-installer.js";
import { verifyLinuxRelease } from "./release-verify.js";

const root = resolve(import.meta.dirname, "..");
export type ReleaseBuildOptions = { readonly outputDirectory?: string; readonly releaseVersion?: string; readonly sourceCommit?: string; readonly writeInstaller?: boolean };

async function sourceCommit(): Promise<string> {
  const child = Bun.spawn({ cmd: ["git", "rev-parse", "--verify", "HEAD^{commit}"], cwd: root, stdout: "pipe", stderr: "pipe" });
  if (await child.exited !== 0) throw new Error("could not determine source commit");
  return (await new Response(child.stdout).text()).trim();
}

async function packageVersion(): Promise<string> {
  const value: unknown = await Bun.file(join(root, "package.json")).json();
  if (typeof value !== "object" || value === null || !("version" in value) || typeof value.version !== "string") throw new Error("package.json contains no version");
  return value.version;
}

export async function buildLinuxRelease(options: ReleaseBuildOptions = {}): Promise<{ readonly directory: string; readonly version: string }> {
  const version = resolveReleaseVersion(await packageVersion(), options.releaseVersion);
  const directory = resolve(options.outputDirectory ?? join(root, "release"));
  const temporary = join(dirname(directory), `.${basename(directory)}.tmp-${process.pid}-${crypto.randomUUID()}`);
  const targets = canonicalReleaseTargets(version);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    for (const target of targets) {
      if (target.target.startsWith("manager-")) continue;
      await buildCli({ outputPath: join(temporary, target.filename), releaseVersion: version, target: target.target as "bun-linux-x64-baseline" | "bun-linux-x64-musl" | "bun-linux-arm64" | "bun-linux-arm64-musl" });
    }
    await buildInstallerManagers(temporary);
    const manifest = createReleaseManifest(version, options.sourceCommit ?? await sourceCommit(), await Promise.all(targets.map(async (target) => ({ filename: target.filename, bytes: await Bun.file(join(temporary, target.filename)).bytes() }))));
    await Promise.all([writeFile(join(temporary, "manifest.json"), serializeManifest(manifest)), writeFile(join(temporary, "SHA256SUMS"), serializeChecksums(manifest))]);
    const writeInstaller = options.writeInstaller ?? true;
    if (writeInstaller) await writeFile(join(root, "install.sh"), await renderInstaller(manifest));
    await verifyLinuxRelease(temporary, { verifyInstallerPins: writeInstaller });
    await rm(directory, { recursive: true, force: true });
    await rename(temporary, directory);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return { directory, version };
}

if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  let releaseVersion: string | undefined;
  let writeInstaller = true;
  let invalidArguments = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--no-write-installer") {
      writeInstaller = false;
    } else if (argument === "--release-version") {
      const version = arguments_[index + 1];
      if (version === undefined) {
        invalidArguments = true;
      } else {
        releaseVersion = version;
        index += 1;
      }
    } else {
      invalidArguments = true;
    }
  }
  if (invalidArguments) {
    process.stderr.write("usage: bun run release:build [--no-write-installer] [--release-version vX.Y.Z]\n");
    process.exitCode = 1;
  } else {
    buildLinuxRelease({ releaseVersion, writeInstaller }).then((release) => process.stdout.write(`Built ${release.directory} (${release.version})\n`)).catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
  }
}
