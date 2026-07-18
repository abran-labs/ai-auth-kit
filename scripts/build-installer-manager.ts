import { chmod, copyFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manager = join(root, "installer-manager");
const names = ["ai-auth-kit-installer-manager-linux-x64-musl", "ai-auth-kit-installer-manager-linux-arm64-musl"] as const;

export type ManagerBuildOptions = { readonly testManager?: boolean };

export async function buildInstallerManagers(output: string, options: ManagerBuildOptions = {}): Promise<readonly string[]> {
  await mkdir(output, { recursive: true });
  const platforms = ["linux/amd64", "linux/arm64"] as const;
  for (const [index, platform] of platforms.entries()) {
    const image = `ai-auth-kit-installer-manager:0.2.0-${options.testManager ? "test-" : ""}${index}`;
    const featureArgs = options.testManager ? ["--build-arg", "CARGO_FEATURES=--features=test-manager"] : [];
    const build = Bun.spawn({ cmd: ["docker", "build", "--pull=false", "--platform", platform, ...featureArgs, "-t", image, manager], cwd: root, stdout: "inherit", stderr: "inherit" });
    if (await build.exited !== 0) throw new Error(`pinned Docker manager builder failed for ${platform}`);
    const copy = Bun.spawn({ cmd: ["docker", "create", "--platform", platform, image], stdout: "pipe", stderr: "pipe" });
    if (await copy.exited !== 0) throw new Error(`could not create ${platform} manager builder container`);
    const container = (await new Response(copy.stdout).text()).trim();
    try {
      const destination = join(output, names[index]);
      const result = Bun.spawn({ cmd: ["docker", "cp", `${container}:/work/target/release/ai-auth-kit-installer-manager`, destination], stdout: "inherit", stderr: "inherit" });
      if (await result.exited !== 0) throw new Error(`could not copy ${platform} manager`);
      await chmod(destination, 0o755);
    } finally {
      await Bun.spawn({ cmd: ["docker", "rm", "-f", container], stdout: "ignore", stderr: "ignore" }).exited;
    }
  }
  return names.map((name) => join(output, name));
}

if (import.meta.main) {
  const output = process.argv[2] ?? join(root, "build", "installer-manager");
  buildInstallerManagers(resolve(output)).then((paths) => process.stdout.write(`${paths.join("\n")}\n`));
}
