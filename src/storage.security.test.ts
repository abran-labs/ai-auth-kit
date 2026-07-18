import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { globalStorage, projectStorage } from "./storage.js";
import type { AuthKitState } from "./types.js";

const state: AuthKitState = { credentials: {}, updatedAt: "2026-07-17T00:00:00.000Z" };

async function inStorageSandbox(action: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-storage-security-"));
  try {
    await action(root);
  } finally {
    delete process.env.AI_AUTH_KIT_INTERRUPT_AT;
    await rm(root, { force: true, recursive: true });
  }
}

function configPath(root: string): string {
  return join(root, ".ai-auth-kit", "safe", "config.json");
}

test("Given a malformed storage name, when project storage is selected, then it rejects before constructing a managed path", () => {
  expect(() => projectStorage(" / / ")).toThrow("Storage name is required");
});

test("Given existing owned managed directories, when storage writes, then only managed roots normalize to 0700", async () => {
  await inStorageSandbox(async (root) => {
    const managedRoot = join(root, ".ai-auth-kit");
    const managedProject = join(managedRoot, "safe");
    const outside = join(root, "outside");
    await mkdir(managedProject, { recursive: true, mode: 0o755 });
    await mkdir(outside, { mode: 0o755 });
    await chmod(managedRoot, 0o755);
    await chmod(managedProject, 0o755);
    await chmod(outside, 0o755);

    await projectStorage("safe", { rootDir: root }).store.write(state);

    expect((await lstat(managedRoot)).mode & 0o777).toBe(0o700);
    expect((await lstat(managedProject)).mode & 0o777).toBe(0o700);
    expect((await lstat(outside)).mode & 0o777).toBe(0o755);
    expect((await lstat(configPath(root))).mode & 0o777).toBe(0o600);
  });
});

test("Given an existing global managed directory, when storage writes, then it normalizes the app directory without changing XDG_CONFIG_HOME", async () => {
  await inStorageSandbox(async (root) => {
    const configHome = join(root, "config");
    const managed = join(configHome, "global-safe");
    await mkdir(managed, { recursive: true, mode: 0o755 });
    await chmod(configHome, 0o755);
    await chmod(managed, 0o755);
    const previous = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configHome;
    try {
      await globalStorage("global-safe").store.write(state);
    } finally {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previous;
    }

    expect((await lstat(managed)).mode & 0o777).toBe(0o700);
    expect((await lstat(configHome)).mode & 0o777).toBe(0o755);
  });
});

test("Given a managed root symlink, when storage writes, then it rejects without touching the outside sentinel", async () => {
  await inStorageSandbox(async (root) => {
    const outside = join(root, "outside");
    const sentinel = join(outside, "sentinel.txt");
    await mkdir(outside);
    await writeFile(sentinel, "untouched");
    await symlink(outside, join(root, ".ai-auth-kit"));

    await expect(projectStorage("safe", { rootDir: root }).store.write(state)).rejects.toThrow("managed directory");

    expect(await readFile(sentinel, "utf8")).toBe("untouched");
  });
});

test("Given a managed FIFO, when storage writes, then it rejects before using the special file", async () => {
  await inStorageSandbox(async (root) => {
    const fifo = join(root, ".ai-auth-kit");
    const command = Bun.spawn({ cmd: ["mkfifo", fifo], stdout: "ignore", stderr: "pipe" });
    expect(await command.exited).toBe(0);

    await expect(projectStorage("safe", { rootDir: root }).store.write(state)).rejects.toThrow("managed directory");
  });
});

test("Given a group-writable managed component, when storage writes, then it rejects without changing the component", async () => {
  await inStorageSandbox(async (root) => {
    const managedRoot = join(root, ".ai-auth-kit");
    await mkdir(managedRoot);
    await chmod(managedRoot, 0o770);

    await expect(projectStorage("safe", { rootDir: root }).store.write(state)).rejects.toThrow("managed directory");

    expect((await lstat(managedRoot)).mode & 0o777).toBe(0o770);
  });
});

test("Given unsafe or symlinked managed targets, when state is read or written, then storage rejects them", async () => {
  await inStorageSandbox(async (root) => {
    const storage = projectStorage("safe", { rootDir: root });
    await storage.store.write(state);
    const target = configPath(root);
    const outside = join(root, "outside.json");
    await writeFile(outside, "{\"credentials\":{},\"updatedAt\":\"outside\"}\n");
    await rm(target);
    await symlink(outside, target);

    await expect(storage.store.read()).rejects.toThrow("regular file");
    await expect(storage.store.write(state)).rejects.toThrow("regular file");
    expect(await readFile(outside, "utf8")).toContain("outside");
  });
});

test("Given a FIFO state target, when storage reads it, then it rejects without blocking", async () => {
  await inStorageSandbox(async (root) => {
    const storage = projectStorage("safe", { rootDir: root });
    await storage.store.write(state);
    const target = configPath(root);
    await rm(target);
    const command = Bun.spawn({ cmd: ["mkfifo", target], stdout: "ignore", stderr: "pipe" });
    expect(await command.exited).toBe(0);

    await expect(storage.store.read()).rejects.toThrow("regular file");
  });
});

test("Given atomic write fault boundaries, when each boundary interrupts, then valid prior or committed bytes remain and temp files are removed", async () => {
  await inStorageSandbox(async (root) => {
    const storage = projectStorage("safe", { rootDir: root });
    await storage.store.write(state);
    const path = configPath(root);
    const prior = await readFile(path, "utf8");
    for (const boundary of ["write", "fsync", "rename", "directory-fsync"] as const) {
      process.env.AI_AUTH_KIT_INTERRUPT_AT = boundary;
      await expect(storage.store.write({ ...state, updatedAt: `2026-07-18T00:00:00.000Z-${boundary}` })).rejects.toThrow("Interrupted atomic write");
      const persisted = await readFile(path, "utf8");
      expect(() => JSON.parse(persisted)).not.toThrow();
      if (boundary === "write" || boundary === "fsync") expect(persisted).toBe(prior);
      expect((await readdir(join(path, ".."))).some((entry) => entry.endsWith(".tmp"))).toBe(false);
      delete process.env.AI_AUTH_KIT_INTERRUPT_AT;
    }
  });
});
