import { describe, expect, test } from "bun:test";
import {
  canonicalReleaseTargets,
  createReleaseManifest,
  serializeChecksums,
} from "../scripts/release-artifacts.js";
import { renderInstaller } from "../scripts/build-installer.js";
import { verifyInstallerPins } from "../scripts/release-verify.js";

describe("AI Auth Kit release artifacts", () => {
  test("Given 0.2.0, when deriving release targets, then returns four CLI and two static manager artifacts", () => {
    expect(canonicalReleaseTargets("0.2.0")).toEqual([
      { arch: "x64", libc: "glibc", os: "linux", runtimePrerequisites: [], target: "bun-linux-x64-baseline", filename: "ai-auth-kit-0.2.0-linux-x64-baseline" },
      { arch: "x64", libc: "musl", os: "linux", runtimePrerequisites: ["libstdc++.so.6", "libgcc_s.so.1"], target: "bun-linux-x64-musl", filename: "ai-auth-kit-0.2.0-linux-x64-musl" },
      { arch: "arm64", libc: "glibc", os: "linux", runtimePrerequisites: [], target: "bun-linux-arm64", filename: "ai-auth-kit-0.2.0-linux-arm64" },
      { arch: "arm64", libc: "musl", os: "linux", runtimePrerequisites: ["libstdc++.so.6", "libgcc_s.so.1"], target: "bun-linux-arm64-musl", filename: "ai-auth-kit-0.2.0-linux-arm64-musl" },
      { arch: "x64", libc: "musl", os: "linux", runtimePrerequisites: [], target: "manager-x64-musl", filename: "ai-auth-kit-installer-manager-linux-x64-musl" },
      { arch: "arm64", libc: "musl", os: "linux", runtimePrerequisites: [], target: "manager-arm64-musl", filename: "ai-auth-kit-installer-manager-linux-arm64-musl" },
    ]);
  });

  test("Given unordered bytes, when generating a manifest, then checksums are stable and include source commit metadata", () => {
    const manifest = createReleaseManifest("0.2.0", "a".repeat(40), [
      { filename: "ai-auth-kit-0.2.0-linux-arm64-musl", bytes: new TextEncoder().encode("arm-musl") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-baseline", bytes: new TextEncoder().encode("x64") },
      { filename: "ai-auth-kit-0.2.0-linux-arm64", bytes: new TextEncoder().encode("arm") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-musl", bytes: new TextEncoder().encode("x64-musl") },
      { filename: "ai-auth-kit-installer-manager-linux-x64-musl", bytes: new TextEncoder().encode("manager-x64") },
      { filename: "ai-auth-kit-installer-manager-linux-arm64-musl", bytes: new TextEncoder().encode("manager-arm64") },
    ]);

    expect(manifest.sourceCommit).toBe("a".repeat(40));
    expect(manifest.artifacts).toHaveLength(6);
    expect(serializeChecksums(manifest).split("\n").filter(Boolean)).toHaveLength(6);
  });

  test("Given a manifest, when rendering the bootstrap, then both manager URLs and hashes come from its actual records", async () => {
    const manifest = createReleaseManifest("0.2.0", "a".repeat(40), [
      { filename: "ai-auth-kit-0.2.0-linux-arm64-musl", bytes: new TextEncoder().encode("arm-musl") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-baseline", bytes: new TextEncoder().encode("x64") },
      { filename: "ai-auth-kit-0.2.0-linux-arm64", bytes: new TextEncoder().encode("arm") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-musl", bytes: new TextEncoder().encode("x64-musl") },
      { filename: "ai-auth-kit-installer-manager-linux-x64-musl", bytes: new TextEncoder().encode("manager-x64") },
      { filename: "ai-auth-kit-installer-manager-linux-arm64-musl", bytes: new TextEncoder().encode("manager-arm64") },
    ]);

    const installer = await renderInstaller(manifest);

    for (const manager of manifest.artifacts.filter((artifact) => artifact.target.startsWith("manager-"))) {
      expect(installer).toContain(`v${manifest.version}/${manager.filename}`);
      expect(installer).toContain(manager.sha256);
    }
    expect(installer).not.toContain("__AI_AUTH_KIT_MANAGER_X64_URL__");
    expect(installer).not.toContain("__AI_AUTH_KIT_MANAGER_ARM64_URL__");
    expect(installer).not.toContain("__AI_AUTH_KIT_MANAGER_X64_SHA256__");
    expect(installer).not.toContain("__AI_AUTH_KIT_MANAGER_ARM64_SHA256__");
  });

  test("Given manager bytes with stale bootstrap pins, when release verification runs, then verification rejects the release", async () => {
    const manifest = createReleaseManifest("0.2.0", "a".repeat(40), [
      { filename: "ai-auth-kit-0.2.0-linux-arm64-musl", bytes: new TextEncoder().encode("arm-musl") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-baseline", bytes: new TextEncoder().encode("x64") },
      { filename: "ai-auth-kit-0.2.0-linux-arm64", bytes: new TextEncoder().encode("arm") },
      { filename: "ai-auth-kit-0.2.0-linux-x64-musl", bytes: new TextEncoder().encode("x64-musl") },
      { filename: "ai-auth-kit-installer-manager-linux-x64-musl", bytes: new TextEncoder().encode("stale-x64-manager") },
      { filename: "ai-auth-kit-installer-manager-linux-arm64-musl", bytes: new TextEncoder().encode("stale-arm64-manager") },
    ]);

    expect(verifyInstallerPins(manifest)).rejects.toThrow("install.sh manager pins do not exactly match manifest manager hashes");
  });
});
