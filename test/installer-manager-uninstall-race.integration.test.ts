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
} from "./installer-manager-test-helpers.js";

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

describe("compiled installer manager uninstall activation safety", () => {
  test.serial("Given unsafe entries in a managed root, when uninstall executes, then it preserves them and stops", async () => {
    for (const kind of ["regular", "symlink", "fifo"] as const) {
      const fixture = await createManagerFixture();
      fixtures.push(fixture.workspace);
      const environment = managerEnvironment(fixture);
      expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
      const root = join(fixture.home, "data", "ai-auth-kit");
      const entry = join(root, `unsafe-${kind}`);
      const sentinel = join(fixture.workspace, `outside-${kind}`);
      await writeFile(sentinel, "outside sentinel\n");
      if (kind === "regular") {
        await writeFile(entry, "unsafe regular\n");
        await chmod(entry, 0o777);
      } else if (kind === "symlink") {
        await symlink(sentinel, entry);
      } else {
        const fifo = Bun.spawn({ cmd: ["mkfifo", entry], stderr: "pipe" });
        expect(await fifo.exited).toBe(0);
      }

      const result = await runManager(managerCommand(fixture, ["--uninstall"]), environment);

      expect(result.exitCode).toBe(1);
      await lstat(entry);
      expect(await readFile(sentinel, "utf8")).toBe("outside sentinel\n");
    }
  }, 30_000);

  test.serial("Given a managed activation, when uninstall executes without a race, then it clears held state and permits reinstall without removing the stable activation link", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const environment = managerEnvironment(fixture);
    expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
    const target = await managedActivation(fixture);

    const result = await runManager(managerCommand(fixture, ["--uninstall"]), environment);

    expect(result.exitCode).toBe(0);
    expect(await managedActivation(fixture)).toBe(target);
    await access(join(fixture.home, "data", "ai-auth-kit"));
    expect(access(join(fixture.home, "data", "ai-auth-kit", "current"))).rejects.toThrow();
    expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
    await access(join(fixture.home, "data", "ai-auth-kit", "current"));
  }, 30_000);

  test.serial("[out of scope: post-validation same-UID race] Given a foreign activation swapped after uninstall validation, when uninstall resumes, then it does not follow or execute the foreign target", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const environment = managerEnvironment(fixture);
    expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
    const activation = join(fixture.home, ".local", "bin", "ai-auth-kit");
    const pauseDirectory = join(fixture.workspace, "uninstall-pause");
    const ready = join(pauseDirectory, "uninstall-activation-commit.ready");
    const resume = join(pauseDirectory, "uninstall-activation-commit.resume");
    const sentinel = join(fixture.workspace, "outside-sentinel");
    const foreignTarget = join(fixture.workspace, "foreign-target");
    const foreignExecution = join(fixture.workspace, "foreign-executed");
    const foreignContent = "foreign uninstall activation\n";
    await mkdir(pauseDirectory, { recursive: true });
    await writeFile(sentinel, "outside sentinel\n");
    await writeFile(foreignTarget, `#!/bin/sh\nprintf 'executed\\n' > '${foreignExecution}'\n`);
    await chmod(foreignTarget, 0o700);
    const child = Bun.spawn({
      cmd: [...managerCommand(fixture, ["--uninstall"])],
      env: {
        ...environment,
        AI_AUTH_KIT_TEST_PAUSE_AT: "uninstall-activation-commit",
        AI_AUTH_KIT_TEST_PAUSE_DIR: pauseDirectory,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await waitForFile(ready);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      for (const kind of ["symlink", "regular", "fifo"] as const) {
        await mkdir(dirname(activation), { recursive: true });
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
    await mkdir(dirname(activation), { recursive: true });
    await rm(activation, { force: true });
    await symlink(foreignTarget, activation);
    const before = await lstat(activation);
    await writeFile(resume, "resume\n");
    const [exitCode] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);

    expect(exitCode).toBe(1);
    expect((await lstat(activation)).ino).toBe(before.ino);
    expect(await managedActivation(fixture)).toBe(foreignTarget);
    expect(access(foreignExecution)).rejects.toThrow();
    expect(await readFile(sentinel, "utf8")).toBe("outside sentinel\n");
    await access(join(fixture.home, "data", "ai-auth-kit", "current"));
  }, 30_000);

  test.serial("[out of scope: post-validation same-UID race] Given the managed root is replaced after validation, when uninstall resumes, then the foreign replacement and original root both survive", async () => {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const environment = managerEnvironment(fixture);
    expect((await runManager(managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment)).exitCode).toBe(0);
    const root = join(fixture.home, "data", "ai-auth-kit");
    const movedRoot = join(fixture.workspace, "moved-managed-root");
    const pauseDirectory = join(fixture.workspace, "root-pause");
    const ready = join(pauseDirectory, "uninstall-root-commit.ready");
    const resume = join(pauseDirectory, "uninstall-root-commit.resume");
    const sentinel = join(fixture.workspace, "outside-root-sentinel");
    const foreignTarget = join(fixture.workspace, "foreign-root-target");
    const foreignContent = "foreign root replacement\n";
    await mkdir(pauseDirectory, { recursive: true });
    await writeFile(sentinel, "outside root sentinel\n");
    await writeFile(foreignTarget, "foreign root target\n");
    const child = Bun.spawn({
      cmd: [...managerCommand(fixture, ["--uninstall"])],
      env: {
        ...environment,
        AI_AUTH_KIT_TEST_PAUSE_AT: "uninstall-root-commit",
        AI_AUTH_KIT_TEST_PAUSE_DIR: pauseDirectory,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await waitForFile(ready);
    await rename(root, movedRoot);

    for (const kind of ["symlink", "fifo", "regular"] as const) {
      await rm(root, { force: true });
      switch (kind) {
        case "symlink":
          await symlink(foreignTarget, root);
          break;
        case "fifo": {
          const fifo = Bun.spawn({ cmd: ["mkfifo", root], stderr: "pipe" });
          expect(await fifo.exited).toBe(0);
          break;
        }
        case "regular":
          await writeFile(root, foreignContent);
          break;
      }
    }
    const before = await lstat(root);
    await writeFile(resume, "resume\n");
    const [exitCode] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);

    expect(exitCode).toBe(1);
    expect((await lstat(root)).ino).toBe(before.ino);
    expect(await readFile(root, "utf8")).toBe(foreignContent);
    expect(await readFile(sentinel, "utf8")).toBe("outside root sentinel\n");
    await access(join(movedRoot, "current"));
  }, 30_000);
});
