import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import type { SafeDirectory } from "./safe-dir.js";

const FILE_MODE = 0o600;
const UNSAFE_WRITE_MODE = 0o022;
const FILE_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

function owned(stat: { readonly uid: number }): boolean {
  const getuid = process.getuid;
  if (!getuid) throw new Error("Storage ownership checks require Linux process.getuid");
  return stat.uid === getuid();
}

async function checkedFile(directory: SafeDirectory, name: string): Promise<Awaited<ReturnType<typeof open>> | undefined> {
  try {
    const handle = await open(`${directory.path()}/${name}`, FILE_FLAGS);
    const stat = await handle.stat();
    if (!stat.isFile() || !owned(stat) || (stat.mode & UNSAFE_WRITE_MODE) !== 0) {
      await handle.close();
      throw new Error("Storage target must be an owned, non-writable regular file");
    }
    await handle.chmod(FILE_MODE);
    return handle;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    if (error instanceof Error && "code" in error && (error.code === "ELOOP" || error.code === "ENOTDIR")) {
      throw new Error("Storage target must be an owned, non-writable regular file", { cause: error });
    }
    throw error;
  }
}

function fault(boundary: string): void {
  if (process.env.AI_AUTH_KIT_INTERRUPT_AT === boundary) throw new Error(`Interrupted atomic write after ${boundary}`);
}

export async function readFileAnchored(directory: SafeDirectory, name: string): Promise<string | undefined> {
  const handle = await checkedFile(directory, name);
  if (!handle) return undefined;
  try {
    return await handle.readFile({ encoding: "utf8" });
  } finally {
    await handle.close();
  }
}

export async function writeFileAtomic(directory: SafeDirectory, name: string, value: unknown): Promise<void> {
  const target = await checkedFile(directory, name);
  await target?.close();
  const temp = `.${name}.${process.pid}.${Date.now()}.tmp`;
  let temporary = true;
  const handle = await open(`${directory.path()}/${temp}`, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, FILE_MODE);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    fault("write");
    await handle.sync();
    fault("fsync");
    const tempStat = await handle.stat();
    await rename(`${directory.path()}/${temp}`, `${directory.path()}/${name}`);
    temporary = false;
    fault("rename");
    const committed = await checkedFile(directory, name);
    if (!committed) throw new Error("Atomic write target disappeared before commit validation");
    try {
      const committedStat = await committed.stat();
      if (committedStat.dev !== tempStat.dev || committedStat.ino !== tempStat.ino) throw new Error("Atomic write target inode changed during commit");
    } finally {
      await committed.close();
    }
    await directory.sync();
    fault("directory-fsync");
  } finally {
    await handle.close();
    if (temporary) await rm(`${directory.path()}/${temp}`, { force: true });
  }
}

export async function unlinkFileAnchored(directory: SafeDirectory, name: string): Promise<void> {
  const target = await checkedFile(directory, name);
  if (!target) return;
  await target.close();
  if (process.env.AI_AUTH_KIT_INTERRUPT_AT === "unlink") throw new Error("Interrupted atomic write after unlink");
  await rm(`${directory.path()}/${name}`);
  await directory.sync();
}
