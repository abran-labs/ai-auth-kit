import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-contract-red-"));
  try {
    await Bun.write(join(directory, "package.json"), '{"type":"module"}\n');
    await Bun.write(join(directory, "index.ts"), "export const retainedExport = true;\n");
    await Bun.write(join(directory, "consumer.ts"), 'import { missingExpectedExport } from "./index.js";\nvoid missingExpectedExport;\n');
    await Bun.write(join(directory, "tsconfig.json"), '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","noEmit":true,"strict":true},"files":["consumer.ts","index.ts"]}\n');
    const compiler = join(process.cwd(), "node_modules", ".bin", "tsc");
    const processResult = Bun.spawn({ cmd: [compiler, "-p", "tsconfig.json"], cwd: directory, stdout: "pipe", stderr: "pipe" });
    const exitCode = await processResult.exited;
    const output = `${await new Response(processResult.stdout).text()}${await new Response(processResult.stderr).text()}`;
    if (exitCode === 0 || !output.includes("has no exported member")) {
      throw new Error(`Missing-export proof did not fail as required:\n${output}`);
    }
    process.stdout.write("Module has no exported member: disposable missing-export proof passed\n");
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

await main();
