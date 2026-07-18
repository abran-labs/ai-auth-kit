import { verify, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { createReleaseManifest } from "../scripts/release-artifacts.js";
import { canonicalBundleBytes, signBundle, unsignedBundle } from "../scripts/release-bundle.js";

const fixtureSigningKey = "O0a4Te+ms8d97xjS4+wYbqGFRfVznu297YubalrVML4=";
const fixturePublicKey = "c22d65899c3cc360c3eadde5d836d429d1fe88b94166960198b4eba85fadcc4a";

describe("signed manager release bundle", () => {
  test("Given canonical release records, when signing the framed bundle, then every record is authenticated", () => {
    const manifest = createReleaseManifest("0.2.0", "a".repeat(40), [
      { filename: "ai-auth-kit-0.2.0-linux-arm64-musl", bytes: new TextEncoder().encode("arm-musl") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-baseline", bytes: new TextEncoder().encode("x64") },
      { filename: "ai-auth-kit-0.2.0-linux-arm64", bytes: new TextEncoder().encode("arm") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-musl", bytes: new TextEncoder().encode("x64-musl") },
      { filename: "ai-auth-kit-installer-manager-linux-x64-musl", bytes: new TextEncoder().encode("manager-x64") },
      { filename: "ai-auth-kit-installer-manager-linux-arm64-musl", bytes: new TextEncoder().encode("manager-arm64") },
    ]);
    const unsigned = unsignedBundle(manifest, "b".repeat(64), "local-fixture-2026-07");
    const signed = signBundle(unsigned, fixtureSigningKey);
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(fixturePublicKey, "hex")]), format: "der", type: "spki" });

    expect(verify(null, canonicalBundleBytes(unsigned), publicKey, Buffer.from(signed.signature, "base64"))).toBe(true);
    expect(verify(null, canonicalBundleBytes({ ...unsigned, tag: "v9.9.9" }), publicKey, Buffer.from(signed.signature, "base64"))).toBe(false);
  });

  test("Given the release workflow, when signing is configured, then the key is gated by manual protected environment approval", async () => {
    const workflow = await readFile(join(resolve(import.meta.dirname, ".."), ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_tag:");
    expect(workflow).toContain("confirm_release:");
    expect(workflow).toContain('test "${{ inputs.confirm_release }}" = true');
    expect(workflow).toMatch(/verify-attestation:[\s\S]*?environment: release[\s\S]*?INSTALLER_MANAGER_SIGNING_KEY/);
    expect(workflow.match(/secrets\.INSTALLER_MANAGER_SIGNING_KEY/g)).toHaveLength(1);
    expect(workflow).not.toContain("push:\n");
  });

  test("Given a release workflow missing its protected signing gate, when statically inspected, then the workflow is rejected", async () => {
    const workflow = await readFile(join(resolve(import.meta.dirname, ".."), ".github", "workflows", "release.yml"), "utf8");
    const withoutEnvironment = workflow.replace("    environment: release\n", "");
    const withoutConfirmation = workflow.replace('          test "${{ inputs.confirm_release }}" = true\n', "");
    const withoutManualDispatch = workflow.replace("  workflow_dispatch:\n", "  push:\n");

    expect(withoutEnvironment).not.toMatch(/verify-attestation:[\s\S]*?environment: release[\s\S]*?INSTALLER_MANAGER_SIGNING_KEY/);
    expect(withoutConfirmation).not.toContain('test "${{ inputs.confirm_release }}" = true');
    expect(withoutManualDispatch).not.toContain("workflow_dispatch:");
  });
});
