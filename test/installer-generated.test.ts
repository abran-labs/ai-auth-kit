import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

const root = resolve(import.meta.dirname, "..");
const directories: string[] = [];

afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixtureBootstrap(tamper = false): Promise<{ readonly installer: string; readonly environment: Record<string, string> }> {
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-bootstrap-"));
  directories.push(directory);
  const bin = join(directory, "bin");
  const manager = join(directory, "manager");
  await mkdir(bin);
  await writeFile(manager, "#!/bin/sh\nprintf '%s\\n' \"$*\" >\"$RESULT\"\n");
  await chmod(manager, 0o755);
  const digest = new Bun.CryptoHasher("sha256").update(await Bun.file(manager).bytes()).digest("hex");
  await writeFile(join(bin, "curl"), `#!/bin/sh\ncp \"${tamper ? `${manager}.tampered` : manager}\" \"$8\"\n`);
  if (tamper) await writeFile(`${manager}.tampered`, "tampered");
  await chmod(join(bin, "curl"), 0o755);
  const source = await readFile(join(root, "install.sh"), "utf8");
  const installer = source.replace(/MANAGER_X64_SHA256='[a-f0-9]{64}'/, `MANAGER_X64_SHA256='${digest}'`).replace(/MANAGER_ARM64_SHA256='[a-f0-9]{64}'/, `MANAGER_ARM64_SHA256='${digest}'`);
  return { installer, environment: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, RESULT: join(directory, "result") } };
}

describe("standalone bootstrap", () => {
  test("Given a pinned manager, when its exact bytes are downloaded, then bootstrap hashes its FD and forwards opaque flags", async () => {
    const fixture = await fixtureBootstrap();
    const child = Bun.spawn({ cmd: ["sh", "-s", "--", "--release-dir", "/fixture", "--update", "--opaque"], env: fixture.environment, stdin: "pipe", stderr: "pipe" });
    child.stdin.write(fixture.installer); child.stdin.end();
    expect(await child.exited, await new Response(child.stderr).text()).toBe(0);
    expect(await Bun.file(fixture.environment.RESULT).text()).toBe("--release-dir /fixture --update --opaque\n");
  });

  test("Given changed manager bytes, when bootstrap hashes the inherited descriptor, then it refuses before exec", async () => {
    const fixture = await fixtureBootstrap(true);
    const child = Bun.spawn({ cmd: ["sh", "-s"], env: fixture.environment, stdin: "pipe", stderr: "pipe" });
    child.stdin.write(fixture.installer); child.stdin.end();
    expect(await child.exited).toBe(1);
    expect(await new Response(child.stderr).text()).toContain("pinned manager SHA-256 mismatch");
  });

  test("Given an unsupported architecture, when bootstrap starts, then it rejects before curl", async () => {
    const fixture = await fixtureBootstrap();
    const bin = fixture.environment.PATH.split(":")[0];
    await writeFile(join(bin, "uname"), "#!/bin/sh\n[ \"$1\" = -s ] && printf 'Linux\\n' || printf 'riscv64\\n'\n");
    await chmod(join(bin, "uname"), 0o755);
    const child = Bun.spawn({ cmd: ["sh", "-s"], env: fixture.environment, stdin: "pipe", stderr: "pipe" });
    child.stdin.write(fixture.installer); child.stdin.end();
    expect(await child.exited).toBe(1);
    expect(await new Response(child.stderr).text()).toContain("unsupported architecture");
  });
});
