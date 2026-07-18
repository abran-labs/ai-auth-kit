import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBounded } from "./disposable-install.js";
import { validateGitDependency } from "./git-dependency.js";

const root = process.cwd();
const authorEnvironment = {
  GIT_AUTHOR_EMAIL: "qa@example.invalid",
  GIT_AUTHOR_NAME: "AI Auth Kit QA",
  GIT_COMMITTER_EMAIL: "qa@example.invalid",
  GIT_COMMITTER_NAME: "AI Auth Kit QA",
};

async function command(cwd: string, command: readonly string[], timeoutMilliseconds = 30_000): Promise<string> {
  const result = await runBounded({ command, cwd, timeoutMilliseconds, maxOutputBytes: 1_000_000 });
  if (result.kind === "timed_out") throw new Error(`hung command: ${command.join(" ")}\n${result.output}`);
  if (result.exitCode !== 0) throw new Error(`failed command: ${command.join(" ")}\n${result.output}`);
  return result.output;
}

async function git(cwd: string, arguments_: readonly string[]): Promise<string> {
  const child = Bun.spawn({ cmd: ["git", ...arguments_], cwd, env: { ...process.env, ...authorEnvironment, GIT_MASTER: "1" }, stdout: "pipe", stderr: "pipe" });
  const output = `${await new Response(child.stdout).text()}${await new Response(child.stderr).text()}`;
  if ((await child.exited) !== 0) throw new Error(`git ${arguments_.join(" ")} failed\n${output}`);
  return output;
}

async function writeConsumer(consumer: string, dependency: string): Promise<void> {
  await writeFile(join(consumer, "package.json"), JSON.stringify({ name: "git-consumer", private: true, type: "module", dependencies: { "@abran-labs/ai-auth-kit": dependency }, devDependencies: { typescript: "^5.9.3" } }, null, 2));
  await writeFile(join(consumer, "source.ts"), 'import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";\nconst kit = createProjectAuthKit("consumer");\nconsole.log(kit.listProviders().length > 0 ? "source import ok" : "source failed");\n');
  await writeFile(join(consumer, "dist.mjs"), 'import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";\nconsole.log(typeof createProjectAuthKit === "function" ? "dist import ok" : "dist failed");\n');
  await writeFile(join(consumer, "types.ts"), 'import { createProjectAuthKit } from "@abran-labs/ai-auth-kit";\nconst kit = createProjectAuthKit("consumer");\nvoid kit;\n');
  await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022", strict: true, skipLibCheck: true }, include: ["types.ts"] }, null, 2));
}

async function assertResolvedSha(consumer: string, sha: string): Promise<void> {
  const lock = await readFile(join(consumer, "bun.lock"), "utf8");
  if (!lock.includes(sha)) throw new Error(`lock does not contain resolved full SHA ${sha}`);
  process.stdout.write(`resolved SHA ${sha}\n`);
}

async function main(): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "ai-auth-kit-git-consumer-"));
  const seed = join(temporary, "seed");
  const bare = join(temporary, "package.git");
  const consumer = join(temporary, "consumer");
  let server: { readonly stop: () => void } | undefined;
  try {
    await cp(root, seed, { recursive: true, filter: (path) => ![".git", ".omo", "node_modules", "coverage"].some((excluded) => path.endsWith(`/${excluded}`)) });
    await git(seed, ["init"]);
    await git(seed, ["add", "."]);
    await git(seed, ["commit", "-m", "disposable package fixture"]);
    const sha = (await git(seed, ["rev-parse", "HEAD"])).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`malformed SHA: ${sha}`);
    if (/^[0-9a-f]{40}$/.test("not-a-sha")) throw new Error("malformed SHA accepted");
    process.stdout.write("malformed SHA rejected\n");
    await writeFile(join(seed, "dirty-worktree-probe.txt"), "dirty\n");
    if ((await git(seed, ["status", "--porcelain"])).trim() === "") throw new Error("dirty worktree misleadingly accepted");
    await rm(join(seed, "dirty-worktree-probe.txt"));
    process.stdout.write("dirty worktree detected\n");
    await git(seed, ["clone", "--bare", ".", bare]);
    await git(bare, ["update-ref", `refs/tags/${sha}`, sha]);
    await git(bare, ["update-ref", "refs/tags/v0.2.0", sha]);
    await writeFile(join(seed, "offline-cache-probe.txt"), "uncached immutable fixture\n");
    await git(seed, ["add", "offline-cache-probe.txt"]);
    await git(seed, ["commit", "-m", "offline cache probe"]);
    const uncachedSha = (await git(seed, ["rev-parse", "HEAD"])).trim();
    await git(seed, ["push", bare, "HEAD:master"]);
    await git(bare, ["update-server-info"]);
    await mkdir(consumer);
    const liveServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        const pathname = new URL(request.url).pathname;
        if (!pathname.startsWith("/package.git/")) return new Response("not found", { status: 404 });
        const file = join(temporary, pathname);
        try {
          await access(file);
          return new Response(Bun.file(file));
        } catch {
          return new Response("not found", { status: 404 });
        }
      },
    });
    server = liveServer;
    if (liveServer.port === undefined) throw new Error("Git fixture server did not bind a port");
    for (const ref of ["master", "v0.2.0", sha.slice(0, 12)]) {
      const mutableConsumer = join(temporary, `mutable-${ref.replace(/[^a-z0-9]/g, "-")}`);
      await mkdir(mutableConsumer);
      const spec = `git+http://127.0.0.1:${liveServer.port}/package.git#${ref}`;
      await writeConsumer(mutableConsumer, spec);
      await command(mutableConsumer, ["bun", "install", "--ignore-scripts"]);
      const mutableLock = await readFile(join(mutableConsumer, "bun.lock"), "utf8");
      try {
        validateGitDependency({ spec, lockSource: mutableLock, expectedSha: sha, allowTestLocalGit: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes("immutable dependency must be")) {
          process.stdout.write(`Bun accepted #${ref}; validator rejected it\n`);
          continue;
        }
        throw error;
      }
      throw new Error(`validator misleadingly accepted #${ref}`);
    }
    await writeConsumer(consumer, `git+http://127.0.0.1:${liveServer.port}/package.git#${sha}`);
    await command(consumer, ["bun", "install", "--ignore-scripts"]);
    const installedLock = await readFile(join(consumer, "bun.lock"), "utf8");
    validateGitDependency({ spec: `git+http://127.0.0.1:${liveServer.port}/package.git#${sha}`, lockSource: installedLock, expectedSha: sha, allowTestLocalGit: true });
    await assertResolvedSha(consumer, sha);
    const hung = await runBounded({ command: ["sh", "-c", "sleep 2"], cwd: consumer, timeoutMilliseconds: 50, maxOutputBytes: 1_000 });
    if (hung.kind !== "timed_out") throw new Error("hung build probe misleadingly succeeded");
    process.stdout.write("hung build interrupted\n");
    for (const [file, expected] of [["source.ts", "source import ok"], ["dist.mjs", "dist import ok"]] as const) {
      const output = await command(consumer, ["bun", "run", file]);
      if (!output.includes(expected)) throw new Error(`misleading success for ${file}: ${output}`);
      process.stdout.write(`${expected}\n`);
    }
    await command(consumer, ["./node_modules/.bin/tsc", "-p", "tsconfig.json"]);
    process.stdout.write("types ok\n");
    const isolatedHome = join(consumer, "isolated-home");
    await mkdir(isolatedHome);
    const isolatedEnvironment = [`HOME=${isolatedHome}`, `XDG_CONFIG_HOME=${join(isolatedHome, ".config")}`, `XDG_CACHE_HOME=${join(isolatedHome, ".cache")}`];
    const help = await command(consumer, ["env", ...isolatedEnvironment, "./node_modules/.bin/ai-auth-kit", "--help"]);
    if (!help.includes("Usage:")) throw new Error("installed bin did not print help");
    process.stdout.write("bin ok\n");
    const providers = await command(consumer, ["env", ...isolatedEnvironment, "./node_modules/.bin/ai-auth-kit", "providers"]);
    if (providers.trim() === "") throw new Error("installed bin did not list providers");
    process.stdout.write("providers ok\n");
    const status = await command(consumer, ["env", ...isolatedEnvironment, "./node_modules/.bin/ai-auth-kit", "catalog", "status"]);
    if (!status.includes("source=snapshot")) throw new Error(`offline snapshot unavailable: ${status}`);
    process.stdout.write("offline snapshot ok\n");
    await rm(join(consumer, "node_modules"), { force: true, recursive: true });
    await command(consumer, ["bun", "install", "--frozen-lockfile", "--offline", "--ignore-scripts"]);
    process.stdout.write("preseeded offline install ok\n");
    await rm(join(consumer, "node_modules"), { force: true, recursive: true });
    const cache = join(temporary, "empty-cache");
    await mkdir(cache);
    const offlineHome = join(temporary, "empty-home");
    await mkdir(offlineHome);
    server.stop();
    server = undefined;
    await writeConsumer(consumer, `git+http://127.0.0.1:${liveServer.port}/package.git#${uncachedSha}`);
    await rm(join(consumer, "bun.lock"), { force: true });
    const offline = Bun.spawn({ cmd: ["bun", "install", "--frozen-lockfile", "--offline", "--ignore-scripts", "--cache-dir", cache], cwd: consumer, env: { ...process.env, HOME: offlineHome, XDG_CACHE_HOME: cache }, stdout: "pipe", stderr: "pipe" });
    await new Response(offline.stdout).text();
    await new Response(offline.stderr).text();
    if ((await offline.exited) === 0) throw new Error("empty-cache offline install misleadingly succeeded");
    process.stdout.write("empty-cache offline limitation confirmed\n");
    await access(join(bare, "HEAD"));
  } finally {
    server?.stop();
    await rm(temporary, { force: true, recursive: true });
  }
}

await main();
