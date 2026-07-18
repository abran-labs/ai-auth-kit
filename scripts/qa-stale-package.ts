import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDist } from "./verify-dist.js";

const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-stale-package-"));

async function mustFail(label: string): Promise<void> {
  try {
    await verifyDist(temporary);
  } catch (error) {
    if (error instanceof Error) {
      process.stdout.write(`${label}: ${error.message}\n`);
      return;
    }
    throw error;
  }
  throw new Error(`${label} misleadingly succeeded`);
}

try {
  await cp(root, temporary, { recursive: true, filter: (path) => ![".git", ".omo", "node_modules", "coverage"].some((excluded) => path.endsWith(`/${excluded}`)) });
  await symlink(join(root, "node_modules"), join(temporary, "node_modules"));
  await rm(join(temporary, "dist", "index.d.ts"));
  await mustFail("missing declaration rejected");
  await cp(join(root, "dist"), join(temporary, "dist"), { recursive: true });
  const stale = join(temporary, "dist", "index.js");
  await writeFile(stale, `${await readFile(stale, "utf8")}\n// stale\n`);
  await mustFail("stale dist rejected");
} finally {
  await rm(temporary, { force: true, recursive: true });
}
