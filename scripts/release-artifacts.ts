import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const COMMIT = /^[a-f0-9]{40}$/;

const TARGETS = [
  { arch: "x64", libc: "glibc", os: "linux", runtimePrerequisites: [], target: "bun-linux-x64-baseline" },
  { arch: "x64", libc: "musl", os: "linux", runtimePrerequisites: ["libstdc++.so.6", "libgcc_s.so.1"], target: "bun-linux-x64-musl" },
  { arch: "arm64", libc: "glibc", os: "linux", runtimePrerequisites: [], target: "bun-linux-arm64" },
  { arch: "arm64", libc: "musl", os: "linux", runtimePrerequisites: ["libstdc++.so.6", "libgcc_s.so.1"], target: "bun-linux-arm64-musl" },
] as const;
const MANAGERS = [
  { arch: "x64", libc: "musl", os: "linux", runtimePrerequisites: [], target: "manager-x64-musl", filename: "ai-auth-kit-installer-manager-linux-x64-musl" },
  { arch: "arm64", libc: "musl", os: "linux", runtimePrerequisites: [], target: "manager-arm64-musl", filename: "ai-auth-kit-installer-manager-linux-arm64-musl" },
] as const;

type CompileTarget = (typeof TARGETS)[number]["target"];
export type ReleaseTarget = ((typeof TARGETS)[number] | (typeof MANAGERS)[number]) & { readonly filename: string };
export type ReleaseArtifact = ReleaseTarget & { readonly sha256: string; readonly size: number };
export type ReleaseManifest = { readonly version: string; readonly sourceCommit: string; readonly artifacts: readonly ReleaseArtifact[] };
export type ArtifactBytes = { readonly filename: string; readonly bytes: Uint8Array };

export class ReleaseArtifactError extends Error {
  readonly name = "ReleaseArtifactError";
}

function assertVersion(version: string): void {
  if (!SEMVER.test(version)) throw new ReleaseArtifactError(`version is malformed: ${version}`);
}

function hash(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

function sort<T extends { readonly filename: string }>(values: readonly T[]): readonly T[] {
  return [...values].sort((left, right) => left.filename.localeCompare(right.filename));
}

export function canonicalReleaseTargets(version: string): readonly ReleaseTarget[] {
  assertVersion(version);
  return [...TARGETS.map((target) => ({
    ...target,
    filename: `ai-auth-kit-${version}-linux-${target.arch}${target.target.endsWith("baseline") ? "-baseline" : target.libc === "musl" ? "-musl" : ""}`,
  })), ...MANAGERS];
}

export function createReleaseManifest(version: string, sourceCommit: string, inputs: readonly ArtifactBytes[]): ReleaseManifest {
  assertVersion(version);
  if (!COMMIT.test(sourceCommit)) throw new ReleaseArtifactError("source commit must be a 40-character lowercase Git SHA");
  const targets = canonicalReleaseTargets(version);
  const inputsByFilename = new Map(inputs.map((input) => [input.filename, input]));
  if (inputs.length !== targets.length || inputsByFilename.size !== targets.length) throw new ReleaseArtifactError("release inventory must contain exactly four CLI and two manager artifacts");
  const artifacts = sort(targets.map((target) => {
    const input = inputsByFilename.get(target.filename);
    if (input === undefined) throw new ReleaseArtifactError(`release artifact missing: ${target.filename}`);
    return { ...target, sha256: hash(input.bytes), size: input.bytes.byteLength };
  }));
  return { version, sourceCommit, artifacts };
}

export function serializeManifest(manifest: ReleaseManifest): string {
  return `${JSON.stringify({ version: manifest.version, sourceCommit: manifest.sourceCommit, artifacts: sort(manifest.artifacts) }, null, 2)}\n`;
}

export function serializeChecksums(manifest: ReleaseManifest): string {
  return `${sort(manifest.artifacts).map((artifact) => `${artifact.sha256}  ${artifact.filename}`).join("\n")}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new ReleaseArtifactError(`manifest ${key} must be a string`);
  return value;
}

function readSize(record: Record<string, unknown>): number {
  const value = record["size"];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new ReleaseArtifactError("manifest size must be positive");
  return value;
}

function readRuntimePrerequisites(record: Record<string, unknown>): readonly string[] {
  const value = record["runtimePrerequisites"];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new ReleaseArtifactError("manifest runtimePrerequisites must be a string array");
  return value;
}

function parseManifest(value: unknown): ReleaseManifest {
  if (!isRecord(value)) throw new ReleaseArtifactError("manifest must be an object");
  const version = readString(value, "version");
  const sourceCommit = readString(value, "sourceCommit");
  assertVersion(version);
  if (!COMMIT.test(sourceCommit)) throw new ReleaseArtifactError("manifest source commit is malformed");
  const rawArtifacts = value["artifacts"];
  if (!Array.isArray(rawArtifacts)) throw new ReleaseArtifactError("manifest artifacts must be an array");
  const targets = new Map(canonicalReleaseTargets(version).map((target) => [target.filename, target]));
  const artifacts = rawArtifacts.map((raw): ReleaseArtifact => {
    if (!isRecord(raw)) throw new ReleaseArtifactError("manifest artifact must be an object");
    const filename = readString(raw, "filename");
    const target = targets.get(filename);
    if (target === undefined) throw new ReleaseArtifactError(`manifest artifact is not canonical: ${filename}`);
    for (const key of ["target", "os", "arch", "libc"] as const) {
      if (readString(raw, key) !== target[key]) throw new ReleaseArtifactError(`manifest ${key} mismatch for ${filename}`);
    }
    if (readRuntimePrerequisites(raw).join("\n") !== target.runtimePrerequisites.join("\n")) throw new ReleaseArtifactError(`manifest runtimePrerequisites mismatch for ${filename}`);
    const sha256 = readString(raw, "sha256");
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ReleaseArtifactError(`manifest SHA-256 is malformed for ${filename}`);
    return { ...target, sha256, size: readSize(raw) };
  });
  if (artifacts.length !== 6 || new Set(artifacts.map((artifact) => artifact.filename)).size !== 6) throw new ReleaseArtifactError("manifest inventory must contain exactly six unique artifacts");
  return { version, sourceCommit, artifacts: sort(artifacts) };
}

export async function verifyReleaseDirectory(directory: string): Promise<ReleaseManifest> {
  const manifest = parseManifest(JSON.parse(await Bun.file(join(directory, "manifest.json")).text()));
  const required = new Set([...manifest.artifacts.map((artifact) => artifact.filename), "manifest.json", "SHA256SUMS"]);
  const permittedExtras = new Set(["install.sh", "LICENSE", "installer-manager-bundle.json"]);
  const entries = (await readdir(directory)).sort();
  if ([...required].some((entry) => !entries.includes(entry)) || entries.some((entry) => !required.has(entry) && !permittedExtras.has(entry))) {
    throw new ReleaseArtifactError("release inventory does not match canonical artifacts");
  }
  for (const artifact of manifest.artifacts) {
    const path = join(directory, artifact.filename);
    const [metadata, bytes] = await Promise.all([stat(path), Bun.file(path).bytes()]);
    if (metadata.size !== artifact.size) throw new ReleaseArtifactError(`byte size mismatch for ${artifact.filename}`);
    if (hash(bytes) !== artifact.sha256) throw new ReleaseArtifactError(`SHA-256 mismatch for ${artifact.filename}`);
  }
  if (await Bun.file(join(directory, "SHA256SUMS")).text() !== serializeChecksums(manifest)) throw new ReleaseArtifactError("SHA256SUMS does not match manifest");
  return manifest;
}

export type BunCompileTarget = CompileTarget;
