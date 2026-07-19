#!/usr/bin/env node
import { readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";

const packageName = "@abran-labs/ai-auth-kit";
const expectedVersion = "1.0.0";
const upgradeCommand = "bun add @abran-labs/ai-auth-kit@1.0.0";
const noActionRequired = "no-action-required";

function reportFailure(path, detected, upgrade = upgradeCommand) {
  console.error(
    `AI Auth Kit version check failed: path=${path} detected=${detected} expected=${expectedVersion} upgrade=${upgrade}`,
  );
  process.exitCode = 1;
}

function parseProjectDirectory(args) {
  if (args.length === 0) return process.cwd();
  if (args.length === 2 && args[0] === "--project-dir" && args[1]?.trim()) {
    return resolve(args[1]);
  }
  throw new Error('usage: check-library-version.mjs [--project-dir "<path>"]');
}

async function readManifest(path) {
  const source = await readFile(path, "utf8");
  const value = JSON.parse(source);
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    !("version" in value) ||
    value.name !== packageName ||
    typeof value.version !== "string"
  ) {
    return undefined;
  }
  return { path, version: value.version };
}

async function findProjectManifest(projectDirectory) {
  const candidate = join(
    await realpath(projectDirectory),
    "node_modules",
    "@abran-labs",
    "ai-auth-kit",
    "package.json",
  );
  let path;
  try {
    path = await realpath(candidate);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return { manifest: await readManifest(path), path };
  } catch (error) {
    if (error instanceof SyntaxError) return { manifest: undefined, path };
    throw error;
  }
}

async function main() {
  const projectDirectory = parseProjectDirectory(process.argv.slice(2));
  const installedPackage = await findProjectManifest(projectDirectory);
  if (installedPackage === undefined) {
    reportFailure("not-found", "not-installed");
    return;
  }
  const manifest = installedPackage.manifest;
  if (manifest === undefined) {
    reportFailure(installedPackage.path, "invalid-package");
    return;
  }
  if (manifest.version !== expectedVersion) {
    reportFailure(manifest.path, manifest.version);
    return;
  }
  console.log(
    `AI Auth Kit version check passed: path=${manifest.path} detected=${manifest.version} expected=${expectedVersion} upgrade=${noActionRequired}`,
  );
}

try {
  await main();
} catch (error) {
  reportFailure("not-found", "checker-error");
  if (error instanceof Error) console.error(`AI Auth Kit version check detail: ${error.message}`);
}
