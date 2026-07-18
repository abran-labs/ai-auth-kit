import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { resolve, sep } from "node:path";

const DIRECTORY_MODE = 0o700;
const UNSAFE_WRITE_MODE = 0o022;
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;

function owned(stat: { readonly uid: number }): boolean {
  const getuid = process.getuid;
  if (!getuid) throw new Error("Storage ownership checks require Linux process.getuid");
  return stat.uid === getuid();
}

function components(path: string): readonly string[] {
  return resolve(path).split(sep).filter(Boolean);
}

export class SafeDirectory {
  readonly fd: number;
  private readonly handle;

  private constructor(handle: Awaited<ReturnType<typeof open>>) {
    this.handle = handle;
    this.fd = handle.fd;
  }

  static async openStorage(configDir: string, managedRoot: string): Promise<SafeDirectory> {
    const target = resolve(configDir);
    const root = resolve(managedRoot);
    let current = new SafeDirectory(await open("/", DIRECTORY_FLAGS));
    let currentPath = "";
    try {
      for (const component of components(target)) {
        const nextPath = `${currentPath}${sep}${component}`;
        const managed = nextPath === root || nextPath === target;
        try {
          await mkdir(`${current.path()}/${component}`, { mode: managed ? DIRECTORY_MODE : 0o755 });
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        }
        let next: SafeDirectory;
        try {
          next = new SafeDirectory(await open(`${current.path()}/${component}`, DIRECTORY_FLAGS));
        } catch (error) {
          if (managed) throw new Error("Storage managed directory must be an owned, non-writable real directory", { cause: error });
          throw error;
        }
        const stat = await next.handle.stat();
        if (!stat.isDirectory() || (managed && (!owned(stat) || (stat.mode & UNSAFE_WRITE_MODE) !== 0))) {
          await next.close();
          throw new Error("Storage managed directory must be an owned, non-writable real directory");
        }
        if (managed) await next.handle.chmod(DIRECTORY_MODE);
        await current.close();
        current = next;
        currentPath = nextPath;
      }
      return current;
    } catch (error) {
      await current.close();
      throw error;
    }
  }

  path(): string {
    return `/proc/self/fd/${this.fd}`;
  }

  async sync(): Promise<void> {
    await this.handle.sync();
  }

  async close(): Promise<void> {
    await this.handle.close();
  }
}
