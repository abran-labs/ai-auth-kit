import { appendFile, chmod, copyFile, mkdir, mkdtemp, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { signBundle, unsignedBundle } from "../scripts/release-bundle.js";
import { createReleaseManifest, type ReleaseManifest } from "../scripts/release-artifacts.js";

const root = resolve(import.meta.dirname, "..");
const fixtureSigningKey = "O0a4Te+ms8d97xjS4+wYbqGFRfVznu297YubalrVML4=";

export type ManagerFixture = {
  readonly workspace: string;
  readonly release: string;
  readonly localReceipt: string;
  readonly manager: string;
  readonly home: string;
  readonly version: string;
  readonly manifest: ReleaseManifest;
};

export type ManagerResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
};

type SignedBundleChange = Readonly<Partial<{
  repository: string;
  workflow: string;
  tag: string;
  manifestSha256: string;
  signature: string;
}>>;

let compiledCli: Promise<{ readonly directory: string; readonly path: string }> | undefined;
let compiledManager: Promise<string> | undefined;

function managerBinary(): string {
  return join(root, "installer-manager", "target-test-manager", "release", "ai-auth-kit-installer-manager");
}

async function digest(path: string): Promise<string> {
  return new Bun.CryptoHasher("sha256").update(await Bun.file(path).bytes()).digest("hex");
}

async function compileCli(path: string): Promise<void> {
  const child = Bun.spawn({
    cmd: ["bun", "build", join(root, "src", "cli.ts"), "--compile", "--target=bun-linux-x64-baseline", "--outfile", path],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (await child.exited !== 0) throw new Error(`CLI fixture build failed: ${await new Response(child.stderr).text()}`);
  await chmod(path, 0o700);
}

async function fixtureCli(): Promise<string> {
  compiledCli ??= (async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-manager-cli-"));
    const path = join(directory, "ai-auth-kit-cli");
    await compileCli(path);
    return { directory, path };
  })();
  return (await compiledCli).path;
}

async function compileManager(): Promise<string> {
  compiledManager ??= (async () => {
    const child = Bun.spawn({ cmd: ["cargo", "build", "--release", "--features", "test-manager", "--target-dir", "installer-manager/target-test-manager", "--manifest-path", "installer-manager/Cargo.toml"], cwd: root, stdout: "pipe", stderr: "pipe" });
    if (await child.exited !== 0) throw new Error(`manager fixture build failed: ${await new Response(child.stderr).text()}`);
    return managerBinary();
  })();
  return compiledManager;
}

export async function createManagerFixture(version = "0.2.0"): Promise<ManagerFixture> {
  const workspace = await mkdtemp(join(tmpdir(), "ai-auth-kit-manager-"));
  const release = join(workspace, "release");
  const cli = await fixtureCli();
  const manager = await compileManager();
  await mkdir(release, { recursive: true });
  const names = [
    `ai-auth-kit-${version}-linux-x64-baseline`,
    `ai-auth-kit-${version}-linux-x64-musl`,
    `ai-auth-kit-${version}-linux-arm64`,
    `ai-auth-kit-${version}-linux-arm64-musl`,
    "ai-auth-kit-installer-manager-linux-x64-musl",
    "ai-auth-kit-installer-manager-linux-arm64-musl",
  ] as const;
  await Promise.all(names.map(async (name, index) => {
    const destination = join(release, name);
    await copyFile(name.startsWith("ai-auth-kit-installer") ? manager : cli, destination);
    if (name !== `ai-auth-kit-${version}-linux-x64-baseline`) await appendFile(destination, `fixture-${index}`);
  }));
  const manifestValue = createReleaseManifest(version, "a".repeat(40), await Promise.all(names.map(async (filename) => ({ filename, bytes: await Bun.file(join(release, filename)).bytes() }))));
  const artifacts = manifestValue.artifacts;
  const manifest = join(release, "manifest.json");
  await writeFile(manifest, `${JSON.stringify(manifestValue)}\n`);
  await writeFile(join(release, "SHA256SUMS"), `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.filename}`).join("\n")}\n`);
  const localReceipt = join(release, "local-test-bundle.json");
  await writeFile(localReceipt, `${JSON.stringify(signBundle(unsignedBundle(manifestValue, await digest(manifest), "local-fixture-2026-07"), fixtureSigningKey))}\n`);
  return { workspace, release, localReceipt, manager, home: join(workspace, "home"), version, manifest: manifestValue };
}

export function managerEnvironment(fixture: ManagerFixture): Record<string, string> {
  return { ...process.env, HOME: fixture.home, XDG_DATA_HOME: join(fixture.home, "data"), AI_AUTH_KIT_TEST_LIBC: "glibc" };
}

export function managerCommand(fixture: ManagerFixture, arguments_: readonly string[]): readonly string[] {
  return [fixture.manager, "--release-dir", fixture.release, ...arguments_];
}

export async function runManager(command: readonly string[], environment: Record<string, string>): Promise<ManagerResult> {
  const child = Bun.spawn({ cmd: [...command], env: environment, stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, 5_000);
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  clearTimeout(timeout);
  return { exitCode, stdout, stderr, timedOut };
}

export async function writePublicReceipt(fixture: ManagerFixture, change: SignedBundleChange): Promise<string> {
  const receipt = join(fixture.release, `public-${crypto.randomUUID()}.json`);
  const manifest = await digest(join(fixture.release, "manifest.json"));
  const signed = signBundle(unsignedBundle(fixture.manifest, manifest), fixtureSigningKey);
  await writeFile(receipt, `${JSON.stringify({ ...signed, ...change })}\n`);
  return receipt;
}

export async function writeDuplicateLocalReceipt(fixture: ManagerFixture): Promise<string> {
  const receipt = join(fixture.release, `duplicate-local-${crypto.randomUUID()}.json`);
  const manifest = await digest(join(fixture.release, "manifest.json"));
  const bundle = unsignedBundle(fixture.manifest, manifest, "local-fixture-2026-07");
  const first = bundle.assets.at(0);
  if (first === undefined) throw new Error("fixture bundle has no assets");
  await writeFile(receipt, `${JSON.stringify(signBundle({ ...bundle, assets: [...bundle.assets, first] }, fixtureSigningKey))}\n`);
  return receipt;
}

export async function managedActivation(fixture: ManagerFixture): Promise<string> {
  return readlink(join(fixture.home, ".local", "bin", "ai-auth-kit"));
}

export async function cleanupManagerFixture(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true });
}

export async function cleanupManagerTestBuild(): Promise<void> {
  if (compiledCli === undefined) return;
  await rm((await compiledCli).directory, { recursive: true, force: true });
  compiledCli = undefined;
}
