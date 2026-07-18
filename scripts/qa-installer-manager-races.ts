import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  cleanupManagerFixture,
  cleanupManagerTestBuild,
  createManagerFixture,
  managedActivation,
  managerCommand,
  managerEnvironment,
  runManager,
} from "../test/installer-manager-test-helpers.js";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 2 || arguments_[0] !== "--evidence" || arguments_[1] === undefined) throw new Error("usage: bun run scripts/qa-installer-manager-races.ts --evidence <directory>");

const evidence = resolve(arguments_[1]);
const lifecycleBoundaries = ["artifact-copy", "artifact-fsync", "object-create", "generation-create", "generation-rename", "generation-fsync", "current-create", "current-rename", "current-fsync", "activation-create", "activation-rename", "activation-fsync", "state-write", "uninstall-delete", "uninstall-fsync"] as const;
const hostileKinds = ["symlink", "fifo", "socket", "regular", "directory"] as const;
const postValidationHostileKinds = ["symlink", "fifo", "regular", "directory"] as const;

async function assertSuccess(label: string, command: readonly string[], environment: Record<string, string>): Promise<void> {
  const result = await runManager(command, environment);
  if (result.exitCode !== 0) throw new Error(`${label} failed: ${result.stderr}`);
}

async function assertSafeOutcome(label: string, command: readonly string[], environment: Record<string, string>, sentinel: string): Promise<number> {
  const before = await readFile(sentinel, "utf8");
  const result = await runManager(command, environment);
  if (result.timedOut) throw new Error(`${label} hung`);
  if (await readFile(sentinel, "utf8") !== before) throw new Error(`${label} mutated outside sentinel`);
  return result.exitCode;
}

async function hostilePath(kind: (typeof hostileKinds)[number], path: string, target: string, listeners: { stop(): void }[]): Promise<void> {
  if (kind === "symlink") return symlink(target, path);
  if (kind === "regular") return writeFile(path, "not a directory");
  if (kind === "directory") return mkdir(path);
  if (kind === "fifo") {
    const child = Bun.spawn({ cmd: ["mkfifo", path], stderr: "pipe" });
    if (await child.exited !== 0) throw new Error(`mkfifo failed: ${await new Response(child.stderr).text()}`);
    return;
  }
  listeners.push(Bun.listen({ unix: path, socket: { data() {}, open() {}, close() {}, error() {} } }));
}

async function raceHostilePath(kind: (typeof hostileKinds)[number], path: string, target: string, listeners: { stop(): void }[]): Promise<void> {
  try {
    await hostilePath(kind, path, target, listeners);
  } catch (error) {
    if (error instanceof Error && /EEXIST|EADDRINUSE|ENOTDIR|EISDIR|File exists/.test(error.message)) return;
    throw error;
  }
}

function stopListeners(listeners: { stop(): void }[]): void {
  listeners.forEach((listener) => { listener.stop(); });
  listeners.splice(0);
}

async function preValidationUnsafePaths(): Promise<string[]> {
  const fixture = await createManagerFixture();
  const environment = managerEnvironment(fixture);
  const outside = join(fixture.workspace, "outside");
  const sentinel = join(outside, "sentinel");
  const paths = [
    join(fixture.home, "data", "ai-auth-kit"),
    join(fixture.home, "data", "ai-auth-kit", "objects"),
    join(fixture.home, "data", "ai-auth-kit", "generations"),
    join(fixture.home, "data", "ai-auth-kit", "current"),
    join(fixture.home, ".local", "bin", "ai-auth-kit"),
  ] as const;
  const listeners: { stop(): void }[] = [];
  try {
    await mkdir(outside, { recursive: true });
    await writeFile(sentinel, "outside sentinel\n");
    const outcomes: string[] = [];
    for (const path of paths) {
      for (const kind of hostileKinds) {
        stopListeners(listeners);
        await rm(path, { recursive: true, force: true });
        await mkdir(dirname(path), { recursive: true });
        await hostilePath(kind, path, outside, listeners);
        const exitCode = await assertSafeOutcome(`${kind}:${path}`, managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment, sentinel);
        outcomes.push(`pre-validation unsafe ${kind} ${path}: exit=${exitCode}`);
      }
    }
    for (const path of paths) {
      const attack = (async () => {
        for (const kind of [...postValidationHostileKinds, ...postValidationHostileKinds]) {
          stopListeners(listeners);
          await rm(path, { recursive: true, force: true });
          await mkdir(dirname(path), { recursive: true });
          await raceHostilePath(kind, path, outside, listeners);
          await Bun.sleep(5);
        }
      })();
      const exits = await Promise.all(Array.from({ length: 6 }, async () => assertSafeOutcome(
        `continuous:${path}`,
        managerCommand(fixture, ["--test-attestation", fixture.localReceipt]),
        environment,
        sentinel,
      )));
      await attack;
      outcomes.push(`out-of-scope post-validation same-UID stress ${path}: exits=${exits.join(",")}; no outside mutation observed`);
    }
    return outcomes;
  } finally {
    stopListeners(listeners);
    await cleanupManagerFixture(fixture.workspace);
  }
}

async function concurrentLifecycle(): Promise<string[]> {
  const initial = await createManagerFixture("0.2.0");
  const update = await createManagerFixture("0.2.1");
  const environment = { ...managerEnvironment(initial), HOME: initial.home, XDG_DATA_HOME: join(initial.home, "data") };
  try {
    await assertSuccess("initial install", managerCommand(initial, ["--test-attestation", initial.localReceipt]), environment);
    const commands = [
      managerCommand(update, ["--test-attestation", update.localReceipt, "--update"]),
      managerCommand(initial, ["--rollback"]),
      managerCommand(update, ["--test-attestation", update.localReceipt, "--update"]),
      managerCommand(initial, ["--uninstall"]),
    ] as const;
    const results = await Promise.all(commands.map((command) => runManager(command, environment)));
    await assertSuccess("serialized recovery install", managerCommand(update, ["--test-attestation", update.localReceipt]), environment);
    if (!(await managedActivation(initial)).endsWith("/current/ai-auth-kit")) throw new Error("recovery activation is not managed");
    return [`concurrency exits=${results.map((result) => result.exitCode).join(",")}`, "flock serialized recovery install"];
  } finally {
    await cleanupManagerFixture(initial.workspace);
    await cleanupManagerFixture(update.workspace);
  }
}

async function interruptionRecovery(): Promise<string[]> {
  const outcomes: string[] = [];
  for (const boundary of lifecycleBoundaries) {
    const fixture = await createManagerFixture();
    const environment = managerEnvironment(fixture);
    try {
      const command = boundary.startsWith("uninstall")
        ? managerCommand(fixture, ["--uninstall"])
        : managerCommand(fixture, ["--test-attestation", fixture.localReceipt]);
      if (boundary.startsWith("uninstall")) await assertSuccess(`prepare ${boundary}`, managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment);
      const crashed = await runManager(command, { ...environment, AI_AUTH_KIT_TEST_FAULT_AT: boundary });
      if (crashed.exitCode === 0 || crashed.timedOut) throw new Error(`fault ${boundary} did not crash at its boundary`);
      await assertSuccess(`recover ${boundary}`, managerCommand(fixture, ["--test-attestation", fixture.localReceipt]), environment);
      outcomes.push(`fault ${boundary}: restart recovered`);
    } finally {
      await cleanupManagerFixture(fixture.workspace);
    }
  }
  return outcomes;
}

try {
  await mkdir(evidence, { recursive: true });
  const outcomes = ["threat-model=normal-user-local", ...await preValidationUnsafePaths(), ...await concurrentLifecycle(), ...await interruptionRecovery()];
  await writeFile(join(evidence, "manager-races.txt"), `${outcomes.join("\n")}\n`);
} finally {
  await cleanupManagerTestBuild();
}
