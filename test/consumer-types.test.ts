import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("Given source and built consumer fixtures, when TypeScript compiles them, then both public surfaces type-check", async () => {
  const root = process.cwd();
  const compiler = join(root, "node_modules", ".bin", "tsc");
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "ai-auth-kit-consumer-types-"));
  const declarationsDirectory = join(temporaryDirectory, "dist");
  const fixtureConfig = join(temporaryDirectory, "tsconfig.json");

  try {
    const build = Bun.spawn({
      cmd: [compiler, "-p", "tsconfig.json", "--emitDeclarationOnly", "--declarationMap", "false", "--outDir", declarationsDirectory],
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const buildOutput = `${await new Response(build.stdout).text()}${await new Response(build.stderr).text()}`;
    expect(await build.exited, buildOutput).toBe(0);

    await writeFile(
      fixtureConfig,
      JSON.stringify({
        extends: join(root, "test", "fixtures", "contracts", "tsconfig.json"),
        compilerOptions: {
          baseUrl: root,
          typeRoots: [join(root, "node_modules", "@types")],
          types: ["bun", "node"],
          paths: {
            "@clack/prompts": [join(root, "node_modules", "@clack", "prompts", "dist", "index.d.mts")],
            "@contract/source": [join(root, "src", "index.ts")],
            "@contract/built": [join(declarationsDirectory, "index.d.ts")],
          },
        },
      }),
    );
    const fixture = Bun.spawn({ cmd: [compiler, "-p", fixtureConfig], cwd: root, stdout: "pipe", stderr: "pipe" });
    const fixtureOutput = `${await new Response(fixture.stdout).text()}${await new Response(fixture.stderr).text()}`;
    expect(await fixture.exited, fixtureOutput).toBe(0);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}, 20_000);
