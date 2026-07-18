import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readFileAnchored, unlinkFileAnchored, writeFileAtomic } from "./atomic-file.js";
import { SafeDirectory } from "./safe-dir.js";
import { parseState } from "./schema.js";
import type { AuthKitState, AuthKitStorage, AuthKitStore, ProjectStorageOptions, SecretStore } from "./types.js";

const DEFAULT_PROJECT_DIR_NAME = ".ai-auth-kit";
const DEFAULT_GLOBAL_DIR_NAME = "ai-auth-kit";

function now(): string { return new Date().toISOString(); }

function sanitizeName(name: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!clean) throw new Error("Storage name is required");
  return clean;
}

async function inDirectory<T>(configDir: string, managedRoot: string, action: (directory: SafeDirectory) => Promise<T>): Promise<T> {
  const directory = await SafeDirectory.openStorage(configDir, managedRoot);
  try { return await action(directory); } finally { await directory.close(); }
}

export function projectConfigDir(projectName: string, options: ProjectStorageOptions = {}): string {
  return resolve(options.rootDir ?? process.cwd(), options.dirName ?? DEFAULT_PROJECT_DIR_NAME, sanitizeName(projectName));
}

export function globalConfigDir(appName = DEFAULT_GLOBAL_DIR_NAME): string {
  return resolve(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), sanitizeName(appName));
}

export function projectStorage(projectName: string, options: ProjectStorageOptions = {}): AuthKitStorage {
  const configDir = projectConfigDir(projectName, options);
  return { store: new FileAuthKitStore(configDir, dirname(configDir)), secrets: new FileSecretStore(configDir, dirname(configDir)) };
}

export function globalStorage(appName = DEFAULT_GLOBAL_DIR_NAME): AuthKitStorage {
  const configDir = globalConfigDir(appName);
  return { store: new FileAuthKitStore(configDir), secrets: new FileSecretStore(configDir) };
}

export function emptyState(): AuthKitState { return { credentials: {}, updatedAt: now() }; }

export class FileAuthKitStore implements AuthKitStore {
  readonly path: string;
  constructor(private readonly configDir: string, private readonly managedRoot = configDir) { this.path = join(configDir, "config.json"); }
  async read(): Promise<AuthKitState> {
    const raw = await inDirectory(this.configDir, this.managedRoot, (directory) => readFileAnchored(directory, "config.json"));
    return raw === undefined ? emptyState() : parseState(JSON.parse(raw));
  }
  async write(state: AuthKitState): Promise<void> {
    await inDirectory(this.configDir, this.managedRoot, (directory) => writeFileAtomic(directory, "config.json", state));
  }
}

export class FileSecretStore implements SecretStore {
  readonly path: string;
  constructor(private readonly configDir: string, private readonly managedRoot = configDir) { this.path = join(configDir, "secrets.json"); }
  async get(ref: string): Promise<string | undefined> { return (await this.readAll())[ref]; }
  async set(ref: string, value: string): Promise<void> { await this.writeAll({ ...await this.readAll(), [ref]: value }); }
  async delete(ref: string): Promise<void> { const data = await this.readAll(); delete data[ref]; await this.writeAll(data); }
  async reconcile(liveRefs: readonly string[]): Promise<void> {
    const data = await this.readAll();
    const kept = Object.fromEntries(Object.entries(data).filter(([ref]) => liveRefs.includes(ref)));
    if (Object.keys(kept).length === Object.keys(data).length) return;
    await this.writeAll(kept);
  }
  private async readAll(): Promise<Record<string, string>> {
    const raw = await inDirectory(this.configDir, this.managedRoot, (directory) => readFileAnchored(directory, "secrets.json"));
    if (raw === undefined) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  }
  private async writeAll(data: Record<string, string>): Promise<void> {
    await inDirectory(this.configDir, this.managedRoot, async (directory) => {
      if (Object.keys(data).length === 0) await unlinkFileAnchored(directory, "secrets.json");
      else await writeFileAtomic(directory, "secrets.json", data);
    });
  }
}
