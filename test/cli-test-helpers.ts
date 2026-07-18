import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const cliPath = join(root, "src", "cli.ts");

export type CliResult = {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
};

export type CliSandbox = {
  readonly configHome: string;
  readonly home: string;
  readonly root: string;
  readonly stateHome: string;
};

export async function inCliSandbox<T>(action: (sandbox: CliSandbox) => Promise<T>): Promise<T> {
  const sandboxRoot = await mkdtemp(join(tmpdir(), "ai-auth-kit-cli-"));
  const sandbox = {
    configHome: join(sandboxRoot, "config"),
    home: join(sandboxRoot, "home"),
    root: join(sandboxRoot, "project"),
    stateHome: join(sandboxRoot, "state"),
  };
  await mkdir(sandbox.root, { recursive: true });
  try {
    return await action(sandbox);
  } finally {
    await rm(sandboxRoot, { force: true, recursive: true });
  }
}

export async function pathExists(path: string): Promise<boolean> {
  return await Bun.file(path).exists();
}

export async function runCli(sandbox: CliSandbox, args: readonly string[], input?: string): Promise<CliResult> {
  const child = Bun.spawn({
    cmd: [process.execPath, "--bun", cliPath, ...args],
    cwd: sandbox.root,
    env: {
      ...process.env,
      HOME: sandbox.home,
      XDG_CONFIG_HOME: sandbox.configHome,
      XDG_STATE_HOME: sandbox.stateHome,
    },
    stderr: "pipe",
    stdin: input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
  });
  if (input !== undefined) {
    const stdin = child.stdin;
    if (!stdin) throw new Error("CLI subprocess stdin is unavailable");
    stdin.write(input);
    stdin.end();
  }
  return {
    exitCode: await child.exited,
    stderr: await new Response(child.stderr).text(),
    stdout: await new Response(child.stdout).text(),
  };
}

export function projectConfigPath(sandbox: CliSandbox, projectName = "default"): string {
  return join(sandbox.root, ".ai-auth-kit", projectName, "config.json");
}

export function projectSecretsPath(sandbox: CliSandbox, projectName = "default"): string {
  return join(sandbox.root, ".ai-auth-kit", projectName, "secrets.json");
}
