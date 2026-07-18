import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { renderInstaller } from "./build-installer.js";
import { type ReleaseArtifact, type ReleaseManifest, verifyReleaseDirectory } from "./release-artifacts.js";

class ReleaseVerificationError extends Error {
  readonly name = "ReleaseVerificationError";
}

async function command(args: readonly string[]): Promise<string> {
  const child = Bun.spawn({ cmd: [...args], stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (exitCode !== 0) throw new ReleaseVerificationError(`${args[0]} failed for ${args.at(-1) ?? "artifact"}: ${stderr}`);
  return stdout;
}

function assertElf(artifact: ReleaseArtifact, fileOutput: string, headers: string, programs: string): void {
  const machine = artifact.arch === "x64" ? "Advanced Micro Devices X86-64" : "AArch64";
  const fileToken = artifact.arch === "x64" ? "x86-64" : "aarch64";
  if (!fileOutput.includes("ELF 64-bit") || !fileOutput.includes(fileToken) || !headers.includes(machine)) throw new ReleaseVerificationError(`ELF architecture mismatch for ${artifact.filename}`);
  const interpreter = programs.includes("Requesting program interpreter");
  const manager = artifact.target.startsWith("manager-");
  if (manager && interpreter) throw new ReleaseVerificationError(`manager must be statically linked: ${artifact.filename}`);
  if (!manager && artifact.libc === "glibc" && (!interpreter || !programs.includes("ld-linux"))) throw new ReleaseVerificationError(`glibc interpreter mismatch for ${artifact.filename}`);
  if (!manager && artifact.libc === "musl" && interpreter && !programs.includes("musl")) throw new ReleaseVerificationError(`musl interpreter mismatch for ${artifact.filename}`);
}

async function verifyArtifact(directory: string, artifact: ReleaseArtifact): Promise<void> {
  const path = join(directory, artifact.filename);
  const [fileOutput, headers, programs, dynamic] = await Promise.all([command(["file", "-Lb", path]), command(["readelf", "-h", path]), command(["readelf", "-l", path]), command(["readelf", "-d", path])]);
  assertElf(artifact, fileOutput, headers, programs);
  const needed = [...dynamic.matchAll(/Shared library: \[([^\]]+)\]/g)].map((match) => match[1]).filter((item): item is string => item !== undefined).sort();
  if (artifact.runtimePrerequisites.every((item) => needed.includes(item)) === false) throw new ReleaseVerificationError(`runtime prerequisites are missing from ${artifact.filename}`);
}

async function verifyHostVersion(directory: string, manifest: ReleaseManifest): Promise<void> {
  if (process.platform !== "linux" || process.arch !== "x64") return;
  const artifact = manifest.artifacts.find((item) => item.arch === "x64" && item.libc === "glibc");
  if (artifact === undefined) throw new ReleaseVerificationError("x64 glibc artifact missing");
  if (await command([join(directory, artifact.filename), "--version"]) !== `${manifest.version}\n`) throw new ReleaseVerificationError(`version output mismatch for ${artifact.filename}`);
}

export async function verifyInstallerPins(manifest: ReleaseManifest): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const [current, expected] = await Promise.all([readFile(join(root, "install.sh"), "utf8"), renderInstaller(manifest)]);
  if (current !== expected) throw new ReleaseVerificationError("install.sh manager pins do not exactly match manifest manager hashes");
}

export type ReleaseVerificationOptions = { readonly verifyInstallerPins?: boolean };

export async function verifyLinuxRelease(directory: string, options: ReleaseVerificationOptions = {}): Promise<ReleaseManifest> {
  const manifest = await verifyReleaseDirectory(directory);
  if (options.verifyInstallerPins ?? true) await verifyInstallerPins(manifest);
  await Promise.all(manifest.artifacts.map((artifact) => verifyArtifact(directory, artifact)));
  await verifyHostVersion(directory, manifest);
  return manifest;
}

if (import.meta.main) {
  const directory = process.argv[2] ?? "release";
  verifyLinuxRelease(directory).then((manifest) => process.stdout.write(`Verified ${manifest.artifacts.length} Linux artifacts (${manifest.version})\n`)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
