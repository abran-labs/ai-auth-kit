import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { buildCli, resolveReleaseVersion } from "../scripts/build-cli.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("standalone AI Auth Kit CLI", () => {
  test("Given a matching tag, when resolving a release version, then returns the package semver", () => {
    expect(resolveReleaseVersion("0.2.0", "v0.2.0")).toBe("0.2.0");
    expect(() => resolveReleaseVersion("0.2.0", "v0.2.1")).toThrow("does not match");
  });

  test("Given a clean temporary destination, when compiling, then the binary reports its embedded version without Bun", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-build-"));
    directories.push(directory);
    const binary = join(directory, "ai-auth-kit");
    await buildCli({ outputPath: binary });
    const child = Bun.spawn({ cmd: [binary, "--version"], stdout: "pipe", stderr: "pipe" });

    expect(await child.exited, await new Response(child.stderr).text()).toBe(0);
    expect(await new Response(child.stdout).text()).toBe("0.2.0\n");
  }, 60_000);
});
