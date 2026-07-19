import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const checker = join(root, "skills", "ai-auth-kit", "scripts", "check-library-version.mjs");

test("Given only an ambient parent installation, when a child project checks its version, then no package fallback is allowed", async () => {
  const ambientRoot = await mkdtemp(join(tmpdir(), "ai-auth-kit-ambient-"));
  const projectRoot = join(ambientRoot, "project");
  const packageRoot = join(ambientRoot, "node_modules", "@abran-labs", "ai-auth-kit");
  try {
    await Promise.all([
      mkdir(projectRoot, { recursive: true }),
      mkdir(join(packageRoot, "dist"), { recursive: true }),
      mkdir(join(packageRoot, "src"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(projectRoot, "package.json"), '{"type":"module"}\n'),
      writeFile(join(packageRoot, "dist", "index.js"), "export {};\n"),
      writeFile(join(packageRoot, "dist", "index.d.ts"), "export {};\n"),
      writeFile(join(packageRoot, "src", "index.ts"), "export {};\n"),
      writeFile(
        join(packageRoot, "package.json"),
        `${JSON.stringify({
          name: "@abran-labs/ai-auth-kit",
          version: "1.0.0",
          type: "module",
          exports: {
            ".": {
              bun: "./src/index.ts",
              types: "./dist/index.d.ts",
              import: "./dist/index.js",
            },
          },
        })}\n`,
      ),
    ]);
    const result = Bun.spawn({
      cmd: ["node", checker, "--project-dir", projectRoot],
      cwd: projectRoot,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([
      result.exited,
      new Response(result.stderr).text(),
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("path=not-found");
    expect(stderr).toContain("detected=not-installed");
    expect(stderr).toContain("expected=1.0.0");
    expect(stderr).toContain("upgrade=bun add @abran-labs/ai-auth-kit@1.0.0");
  } finally {
    await rm(ambientRoot, { recursive: true });
  }
});
