import { sign, createPrivateKey } from "node:crypto";
import type { ReleaseManifest } from "./release-artifacts.js";

export const BUNDLE_SCHEMA = "ai-auth-kit-signed-release-bundle-v1";
export const BUNDLE_KEY_ID = "release-2026-07";
export const REPOSITORY = "abran-labs/ai-auth-kit";
export const WORKFLOW = ".github/workflows/release.yml";

export type SignedReleaseBundle = {
  readonly schema: string;
  readonly key_id: string;
  readonly repository: string;
  readonly workflow: string;
  readonly tag: string;
  readonly version: string;
  readonly sourceCommit: string;
  readonly manifestSha256: string;
  readonly assets: readonly {
    readonly name: string;
    readonly target: string;
    readonly os: string;
    readonly arch: string;
    readonly libc: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly attestation: { readonly kind: string; readonly verifier: string; readonly verified: boolean };
  readonly signature: string;
};

type UnsignedBundle = Omit<SignedReleaseBundle, "signature">;

export function canonicalBundleBytes(bundle: UnsignedBundle): Uint8Array {
  const bytes: number[] = [...new TextEncoder().encode(`${BUNDLE_SCHEMA}\0`)];
  const appendString = (value: string): void => {
    const encoded = new TextEncoder().encode(value);
    appendU32(bytes, encoded.byteLength);
    bytes.push(...encoded);
  };
  for (const value of [bundle.schema, bundle.key_id, bundle.repository, bundle.workflow, bundle.tag, bundle.version, bundle.sourceCommit, bundle.manifestSha256]) appendString(value);
  appendU32(bytes, bundle.assets.length);
  for (const asset of bundle.assets) {
    for (const value of [asset.name, asset.target, asset.os, asset.arch, asset.libc, asset.sha256]) appendString(value);
    appendU64(bytes, asset.size);
  }
  for (const value of [bundle.attestation.kind, bundle.attestation.verifier, bundle.attestation.verified ? "true" : "false"]) appendString(value);
  return Uint8Array.from(bytes);
}

export function unsignedBundle(manifest: ReleaseManifest, manifestSha256: string, keyId = BUNDLE_KEY_ID): UnsignedBundle {
  return {
    schema: BUNDLE_SCHEMA,
    key_id: keyId,
    repository: REPOSITORY,
    workflow: WORKFLOW,
    tag: `v${manifest.version}`,
    version: manifest.version,
    sourceCommit: manifest.sourceCommit,
    manifestSha256,
    assets: [...manifest.artifacts].map((asset) => ({ name: asset.filename, target: asset.target, os: asset.os, arch: asset.arch, libc: asset.libc, size: asset.size, sha256: asset.sha256 })),
    attestation: { kind: "github-attestation-verified-v1", verifier: "gh-attestation-verify", verified: true },
  };
}

export function signBundle(bundle: UnsignedBundle, privateSeedBase64: string): SignedReleaseBundle {
  const seed = Buffer.from(privateSeedBase64, "base64");
  if (seed.byteLength !== 32) throw new Error("INSTALLER_MANAGER_SIGNING_KEY must be a base64 Ed25519 32-byte seed");
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  return { ...bundle, signature: sign(null, canonicalBundleBytes(bundle), key).toString("base64") };
}

function appendU32(output: number[], value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) throw new Error("canonical bundle length is invalid");
  output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function appendU64(output: number[], value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("canonical bundle size is invalid");
  const high = Math.floor(value / 0x1_0000_0000);
  appendU32(output, high);
  appendU32(output, value >>> 0);
}
