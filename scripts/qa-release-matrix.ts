import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { buildInstallerManagers } from "./build-installer-manager.js";
import { signBundle, unsignedBundle } from "./release-bundle.js";
import { verifyLinuxRelease } from "./release-verify.js";

const fixtureSigningKey = "O0a4Te+ms8d97xjS4+wYbqGFRfVznu297YubalrVML4=";
const alpine = "alpine:3.21";

function evidenceArgument(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--evidence" || argv[1] === undefined) throw new Error("usage: bun run scripts/qa-release-matrix.ts --evidence <directory>");
  return resolve(argv[1]);
}

async function container(evidence: string, platform: "linux/amd64" | "linux/arm64", command: string): Promise<{ readonly exitCode: number; readonly output: string }> {
  const child = Bun.spawn({ cmd: ["docker", "run", "--rm", "--platform", platform, "-v", `${resolve("release")}:/release:ro`, "-v", `${evidence}:/evidence:ro`, alpine, "sh", "-ceu", command], stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { exitCode, output: `${stdout}${stderr}` };
}

const evidence = evidenceArgument(process.argv.slice(2));
await mkdir(evidence, { recursive: true });
const manifest = await verifyLinuxRelease(resolve("release"));
const artifact = (target: string) => {
  const value = manifest.artifacts.find((item) => item.target === target);
  if (value === undefined) throw new Error(`${target} artifact is missing`);
  return value;
};
const testManagers = join(evidence, ".test-managers");
await rm(testManagers, { recursive: true, force: true });
try {
  const paths = await buildInstallerManagers(testManagers, { testManager: true });
  const digest = new Bun.CryptoHasher("sha256").update(await Bun.file(resolve("release", "manifest.json")).bytes()).digest("hex");
  await Bun.write(join(evidence, "local-test-bundle.json"), `${JSON.stringify(signBundle(unsignedBundle(manifest, digest, "local-fixture-2026-07"), fixtureSigningKey))}\n`);
  const outcomes: string[] = [];
  for (const [arch, platform, managerPath] of [["x64", "linux/amd64", paths[0]], ["arm64", "linux/arm64", paths[1]]] as const) {
    if (managerPath === undefined) throw new Error(`${arch} test manager is missing`);
    const musl = artifact(`bun-linux-${arch}-musl`);
    const releasedManager = artifact(`manager-${arch}-musl`);
    const missing = await container(evidence, platform, `HOME=/tmp/home XDG_DATA_HOME=/tmp/data AI_AUTH_KIT_TEST_LIBC=musl /evidence/.test-managers/${basename(managerPath)} --release-dir /release --test-attestation /evidence/local-test-bundle.json`);
    if (missing.exitCode !== 1 || !missing.output.includes("apk add --no-cache libstdc++")) throw new Error(`Alpine ${arch} missing-prerequisite preflight was not actionable: ${missing.output}`);
    const runtime = await container(evidence, platform, `apk add --no-cache libstdc++; /release/${musl.filename} --version`);
    if (runtime.exitCode !== 0 || runtime.output.trim().split("\n").at(-1) !== manifest.version) throw new Error(`Alpine ${arch} musl CLI runtime failed: ${runtime.output}`);
    const manager = await container(evidence, platform, `/release/${releasedManager.filename} --help >/dev/null`);
    if (manager.exitCode !== 0) throw new Error(`Alpine ${arch} static manager failed: ${manager.output}`);
    outcomes.push(`${arch}\tmissing-preflight=ok\tcli=${manifest.version}\tstatic-manager=ok`);
  }
  await Bun.write(join(evidence, "alpine-musl-runtime.txt"), `${outcomes.join("\n")}\n`);
} finally {
  await rm(testManagers, { recursive: true, force: true });
}
await Bun.write(resolve(evidence, "release-artifacts.txt"), `${manifest.artifacts.map((item) => `${item.filename}\t${item.arch}\t${item.libc}\t${item.sha256}`).join("\n")}\n`);
process.stdout.write(`Verified ${manifest.artifacts.length} target artifacts (${manifest.version})\n`);
