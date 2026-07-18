import { chmod, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, afterEach, expect, test } from "bun:test";
import {
  cleanupManagerFixture,
  cleanupManagerTestBuild,
  createManagerFixture,
  managerCommand,
  managerEnvironment,
  runManager,
} from "./installer-manager-test-helpers.js";

const fixtures: string[] = [];

afterEach(async () => Promise.all(fixtures.splice(0).map(cleanupManagerFixture)));
afterAll(cleanupManagerTestBuild);

test("Given a hostile selected artifact, when install loads the release, then it rejects before loader processing", async () => {
  for (const kind of ["symlink", "fifo", "socket", "regular"] as const) {
    const fixture = await createManagerFixture();
    fixtures.push(fixture.workspace);
    const artifact = fixture.manifest.artifacts.find((item) => item.target === "bun-linux-x64-baseline");
    if (artifact === undefined) throw new Error("fixture lacks selected artifact");
    const path = join(fixture.release, artifact.filename);
    const marker = join(fixture.workspace, "loader-executed");
    const listeners: { stop(): void }[] = [];
    await rm(path);
    if (kind === "symlink") {
      const target = join(fixture.workspace, "foreign-artifact");
      await writeFile(target, `#!/bin/sh\nprintf 'executed\\n' > '${marker}'\n`);
      await chmod(target, 0o700);
      await symlink(target, path);
    } else if (kind === "fifo") {
      const child = Bun.spawn({ cmd: ["mkfifo", path], stderr: "pipe" });
      expect(await child.exited).toBe(0);
    } else if (kind === "socket") {
      listeners.push(Bun.listen({ unix: path, socket: { data() {}, open() {}, close() {}, error() {} } }));
    } else {
      await writeFile(path, "foreign regular artifact\n");
    }

    const result = await runManager(
      managerCommand(fixture, ["--test-attestation", fixture.localReceipt]),
      managerEnvironment(fixture),
    );

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBeFalse();
    expect(Bun.file(marker).exists()).resolves.toBeFalse();
    listeners.forEach((listener) => { listener.stop(); });
  }
}, 30_000);
