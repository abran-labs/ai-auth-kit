import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AuthKitState, AuthKitStore, SecretStore } from "./types.js";
import { parseState } from "./schema.js";

const DEFAULT_DIR_NAME = "ai-auth-kit";

function now(): string {
  return new Date().toISOString();
}

export function defaultConfigDir(appName = DEFAULT_DIR_NAME): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, appName);
}

export function emptyState(): AuthKitState {
  return { credentials: {}, updatedAt: now() };
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, path);
}

export class FileAuthKitStore implements AuthKitStore {
  readonly path: string;

  constructor(configDir = defaultConfigDir()) {
    this.path = join(configDir, "config.json");
  }

  async read(): Promise<AuthKitState> {
    try {
      const raw = await readFile(this.path, "utf8");
      return parseState(JSON.parse(raw));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyState();
      throw error;
    }
  }

  async write(state: AuthKitState): Promise<void> {
    await writeJsonAtomic(this.path, state);
  }
}

export class FileSecretStore implements SecretStore {
  readonly path: string;

  constructor(configDir = defaultConfigDir()) {
    this.path = join(configDir, "secrets.json");
  }

  async get(ref: string): Promise<string | undefined> {
    const data = await this.readAll();
    return data[ref];
  }

  async set(ref: string, value: string): Promise<void> {
    const data = await this.readAll();
    await writeJsonAtomic(this.path, { ...data, [ref]: value });
  }

  async delete(ref: string): Promise<void> {
    const data = await this.readAll();
    delete data[ref];
    if (Object.keys(data).length === 0) {
      await rm(this.path, { force: true });
      return;
    }
    await writeJsonAtomic(this.path, data);
  }

  private async readAll(): Promise<Record<string, string>> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") result[key] = value;
      }
      return result;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
      throw error;
    }
  }
}
