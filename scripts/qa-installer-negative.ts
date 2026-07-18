import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

function evidenceArgument(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--evidence" || argv[1] === undefined) throw new Error("usage: bun run scripts/qa-installer-negative.ts --evidence <directory>");
  return resolve(argv[1]);
}

const evidence = evidenceArgument(process.argv.slice(2));
await mkdir(evidence, { recursive: true });
const managerBuild = Bun.spawn({ cmd: ["cargo", "build", "--release", "--features", "test-manager", "--target-dir", "installer-manager/target-test-manager", "--manifest-path", "installer-manager/Cargo.toml"], stdout: "inherit", stderr: "inherit" });
if (await managerBuild.exited !== 0) throw new Error("test-manager build failed");
const commands = [
  ["bun", "test", "test/installer-generated.test.ts", "test/installer-manager.integration.test.ts"],
];
const output: string[] = [];
for (const command of commands) {
  const child = Bun.spawn({ cmd: command, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  output.push(`${stdout}${stderr}`);
  if (exitCode !== 0) process.exitCode = exitCode;
}
await Bun.write(resolve(evidence, "installer-negative.txt"), output.join(""));
