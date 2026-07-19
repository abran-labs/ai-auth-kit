import { expect, test } from "bun:test";

test("Given a host-owned prompt adapter, when root library APIs select a provider and model, then the reusable host workflow succeeds", async () => {
  const processResult = Bun.spawn({
    cmd: [process.execPath, "--bun", "scripts/qa-library-host.ts"],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    processResult.exited,
    new Response(processResult.stderr).text(),
    new Response(processResult.stdout).text(),
  ]);

  expect(exitCode, stderr).toBe(0);
  expect(stdout).toMatch(/^host-library-qa provider=.+ model=.+\n$/);
});
