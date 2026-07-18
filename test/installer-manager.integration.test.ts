import { watch } from "node:fs";
import { access, chmod, lstat, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  cleanupManagerFixture,
  cleanupManagerTestBuild,
  createManagerFixture,
  managedActivation,
  managerCommand,
  managerEnvironment,
  runManager,
  writeDuplicateLocalReceipt,
  writePublicReceipt,
} from "./installer-manager-test-helpers.js";
import type { ReleaseArtifact } from "../scripts/release-artifacts.js";

const fixtures: string[] = [];

afterEach(async () => Promise.all(fixtures.splice(0).map(cleanupManagerFixture)));
afterAll(cleanupManagerTestBuild);

async function waitForFile(path: string): Promise<void> {
  if (await Bun.file(path).exists()) return;
  await new Promise<void>((resolve) => {
    const watcher = watch(dirname(path), (_event, name) => {
      if (name?.toString() !== basename(path)) return;
      watcher.close();
      resolve();
    });
  });
}

describe("compiled installer manager receipts", () => {
  test("Given a local receipt, when install executes, then only local-test mode accepts its fixture", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);

    const result = await runManager(
      managerCommand(fixture, ["--test-attestation", fixture.localReceipt]),
      managerEnvironment(fixture),
    );

    expect(result.exitCode).toBe(0);
  }, 30_000);

  for (const [name, change] of [
    ["wrong repository", { repository: "wrong/repository" }],
    ["wrong workflow", { workflow: ".github/workflows/wrong.yml" }],
    ["wrong tag", { tag: "v9.9.9" }],
    ["wrong manifest", { manifestSha256: "0".repeat(64) }],
    ["forged signature", { signature: "A".repeat(88) }],
  ] as const) {
    test(`Given a ${name} public receipt, when install executes, then public mode rejects it`, async () => {
      const fixture = await createManagerFixture();
      fixtures.push(fixture.workspace);
      const receipt = await writePublicReceipt(fixture, change);

      const result = await runManager(
        managerCommand(fixture, ["--attestation-receipt", receipt]),
        managerEnvironment(fixture),
      );

      expect(result.exitCode).toBe(1);
    });
  }

  test("Given a missing public receipt, when install executes, then public mode rejects it", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);

    const result = await runManager(
      managerCommand(fixture, ["--attestation-receipt", join(fixture.release, "missing.json")]),
      managerEnvironment(fixture),
    );

    expect(result.exitCode).toBe(1);
  });

  test("Given a local-test receipt, when passed to public mode, then manager rejects it", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);

    const result = await runManager(
      managerCommand(fixture, ["--attestation-receipt", fixture.localReceipt]),
      managerEnvironment(fixture),
    );

    expect(result.exitCode).toBe(1);
  });

  test("Given malformed or absent receipts, when install executes, then manager rejects both before mutation", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const malformed = join(fixture.release, "malformed.json");
    await writeFile(malformed, "{");
    const environment = managerEnvironment(fixture);

    const malformedResult = await runManager(managerCommand(fixture, ["--attestation-receipt", malformed]), environment);
    const absentResult = await runManager(managerCommand(fixture, []), environment);

    expect(malformedResult.exitCode).toBe(1);
    expect(absentResult.exitCode).toBe(1);
  });

  for (const [name, mutate] of [
    ["asset name", (first: ReleaseArtifact) => ({ filename: first.filename })],
    ["target", (first: ReleaseArtifact) => ({ target: first.target })],
    ["digest", (first: ReleaseArtifact) => ({ sha256: first.sha256 })],
  ] as const) {
    test(`Given a duplicate manifest ${name}, when install executes, then manager rejects it before trust or mutation`, async () => {
      const fixture = await createManagerFixture();
      fixtures.push(fixture.workspace);
      const [first, second] = fixture.manifest.artifacts;
      if (first === undefined || second === undefined) throw new Error("fixture manifest lacks artifacts");
      const artifacts = fixture.manifest.artifacts.map((artifact, index) => index === 1 ? { ...artifact, ...mutate(first) } : artifact);
      await writeFile(join(fixture.release, "manifest.json"), `${JSON.stringify({ ...fixture.manifest, artifacts })}\n`);

      const result = await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), managerEnvironment(fixture));

      expect(result.exitCode).toBe(1);
      expect(access(join(fixture.home, "data", "ai-auth-kit"))).rejects.toThrow();
    });
  }

  test("Given a duplicate checksum entry, when install executes, then manager rejects it before trust or mutation", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const first = fixture.manifest.artifacts.at(0);
    if (first === undefined) throw new Error("fixture manifest lacks artifacts");
    await writeFile(join(fixture.release, "SHA256SUMS"), `${first.sha256}  ${first.filename}\n${first.sha256}  ${first.filename}\n`);

    const result = await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), managerEnvironment(fixture));

    expect(result.exitCode).toBe(1);
    expect(access(join(fixture.home, "data", "ai-auth-kit"))).rejects.toThrow();
  });

  test("Given symlink or FIFO release metadata, when install opens it, then held no-follow validation rejects without blocking or mutation", async () => {
    for (const filename of ["manifest.json", "SHA256SUMS"] as const) {
      for (const kind of ["symlink", "fifo"] as const) {
        const fixture = await createManagerFixture();
        fixtures.push(fixture.workspace);
        const path = join(fixture.release, filename);
        const original = join(fixture.release, `${filename}.original`);
        await rename(path, original);
        if (kind === "symlink") await symlink(original, path);
        else expect(Bun.spawnSync(["mkfifo", path]).exitCode).toBe(0);

        const result = await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), managerEnvironment(fixture));

        expect(result.timedOut, `${filename} ${kind}`).toBeFalse();
        expect(result.exitCode, `${filename} ${kind}: ${result.stderr}`).toBe(1);
        expect(access(join(fixture.home, "data", "ai-auth-kit"))).rejects.toThrow();
      }
    }
  }, 30_000);

  test("Given duplicate signed provenance assets, when install executes, then manager rejects them before mutation", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const receipt = await writeDuplicateLocalReceipt(fixture);

    const result = await runManager(managerCommand(fixture, ["--test-attestation", receipt]), managerEnvironment(fixture));

    expect(result.exitCode).toBe(1);
    expect(access(join(fixture.home, "data", "ai-auth-kit"))).rejects.toThrow();
  });

  test("Given unsafe pre-existing managed root or child directories, when install executes, then manager rejects and preserves attacker data", async () => {
    for (const child of [undefined, "objects", "generations"] as const) {
      const fixture = await createManagerFixture();
      fixtures.push(fixture.workspace);
      const root = join(fixture.home, "data", "ai-auth-kit");
      const directory = child === undefined ? root : join(root, child);
      const sentinel = join(directory, "attacker-sentinel");
      const activation = join(fixture.home, ".local", "bin", "ai-auth-kit");
      await mkdir(directory, { recursive: true });
      await writeFile(sentinel, `unsafe ${child ?? "root"}\n`);
      await chmod(directory, 0o777);

      const result = await runManager(
        managerCommand(fixture, ["--test-attestation", fixture.localReceipt]),
        managerEnvironment(fixture),
      );

      expect(result.exitCode).toBe(1);
      expect(await readFile(sentinel, "utf8")).toBe(`unsafe ${child ?? "root"}\n`);
      expect(lstat(activation)).rejects.toThrow();
      expect(access(join(root, "lock"))).rejects.toThrow();
    }
  }, 30_000);

  test("Given a foreign activation, when uninstall uses force, then manager refuses without changing it", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const environment = managerEnvironment(fixture);
    expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
    const activation = join(fixture.home, ".local", "bin", "ai-auth-kit");
    const foreign = join(fixture.workspace, "foreign-cli");
    await rm(activation);
    await symlink(foreign, activation);

    const result = await runManager(managerCommand(fixture, ["--uninstall", "--force"]), environment);

    expect(result.exitCode).toBe(1);
    expect(await managedActivation(fixture)).toBe(foreign);
  });

  test("Given a foreign activation, when install uses force, then manager refuses before creating managed state", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const activationDirectory = join(fixture.home, ".local", "bin");
    const activation = join(activationDirectory, "ai-auth-kit");
    const foreign = join(fixture.workspace, "foreign-cli");
    await mkdir(activationDirectory, { recursive: true });
    await symlink(foreign, activation);

    const result = await runManager(
      managerCommand(fixture, ["--test-attestation", fixture.localReceipt, "--force"]),
      managerEnvironment(fixture),
    );

    expect(result.exitCode).toBe(1);
    expect(await managedActivation(fixture)).toBe(foreign);
    expect(access(join(fixture.home, "data", "ai-auth-kit"))).rejects.toThrow();
  });

  test("[out of scope: post-validation same-UID race] Given a foreign activation swapped after validation, when install resumes, then it does not follow or execute the foreign target", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const activationDirectory = join(fixture.home, ".local", "bin");
    const activation = join(activationDirectory, "ai-auth-kit");
    const pauseDirectory = join(fixture.workspace, "activation-pause");
    const ready = join(pauseDirectory, "activation-commit.ready");
    const resume = join(pauseDirectory, "activation-commit.resume");
    const foreignTarget = join(fixture.workspace, "foreign-target");
    const foreignExecution = join(fixture.workspace, "foreign-executed");
    const foreignContent = "foreign regular activation\n";
    await mkdir(activationDirectory, { recursive: true });
    await mkdir(pauseDirectory, { recursive: true });
    await writeFile(foreignTarget, `#!/bin/sh\nprintf 'executed\\n' > '${foreignExecution}'\n`);
    await chmod(foreignTarget, 0o700);
    const child = Bun.spawn({
      cmd: [...managerCommand(fixture, ["--test-attestation", fixture.localReceipt])],
      env: {
        ...managerEnvironment(fixture),
        AI_AUTH_KIT_TEST_PAUSE_AT: "activation-commit",
        AI_AUTH_KIT_TEST_PAUSE_DIR: pauseDirectory,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await waitForFile(ready);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      for (const kind of ["symlink", "regular", "fifo"] as const) {
        await mkdir(activationDirectory, { recursive: true });
        await rm(activation, { force: true });
        switch (kind) {
          case "symlink":
            await symlink(foreignTarget, activation);
            break;
          case "regular":
            await writeFile(activation, foreignContent);
            break;
          case "fifo": {
            const fifo = Bun.spawn({ cmd: ["mkfifo", activation], stderr: "pipe" });
            expect(await fifo.exited).toBe(0);
            break;
          }
        }
      }
    }
    await mkdir(activationDirectory, { recursive: true });
    await rm(activation, { force: true });
    await symlink(foreignTarget, activation);
    const before = await lstat(activation);
    await writeFile(resume, "resume\n");
    const [exitCode] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);

    expect(exitCode).toBe(1);
    expect((await lstat(activation)).ino).toBe(before.ino);
    expect(await managedActivation(fixture)).toBe(foreignTarget);
    expect(access(foreignExecution)).rejects.toThrow();
    expect(access(join(fixture.home, "data", "ai-auth-kit", "current"))).rejects.toThrow();
    expect(access(join(fixture.home, "data", "ai-auth-kit", "generations"))).rejects.toThrow();
  }, 30_000);
});
