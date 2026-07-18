#!/usr/bin/env node
import * as prompts from "@clack/prompts";
import { createProjectAuthKit } from "./kit.js";
import { loginWithPrompts, pickModel, pickProvider } from "./picker.js";

interface ParsedArgs {
  readonly command: string;
  readonly args: readonly string[];
  readonly projectName: string;
}

function usage(): string {
  return `ai-auth-kit

Usage:
  ai-auth-kit init [--project name]
  ai-auth-kit providers [--project name]
  ai-auth-kit login [provider] [--project name]
  ai-auth-kit models [provider] [--project name]
  ai-auth-kit use [provider] [model] [--project name]
  ai-auth-kit current [--project name]
  ai-auth-kit doctor [--project name]
  ai-auth-kit path [--project name]

Storage defaults to ./.ai-auth-kit/<project-name>.
Project name defaults to "default".
`;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const args: string[] = [];
  let projectName = "default";

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === "--project" || item === "-p") {
      const projectValue = rest[index + 1];
      if (!projectValue || projectValue.startsWith("-")) {
        throw new Error("Missing value for --project");
      }
      projectName = projectValue;
      index += 1;
      continue;
    }
    args.push(item);
  }

  return { command, args, projectName };
}

async function main(argv: readonly string[]): Promise<number> {
  const { command, args, projectName } = parseArgs(argv);

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return 0;
  }

  const kit = createProjectAuthKit(projectName);

  if (command === "init") {
    const state = await kit.readState();
    await kit.store.write(state);
    prompts.outro(`Initialized ${kit.store.path ?? "project storage"}`);
    return 0;
  }

  if (command === "providers") {
    for (const provider of kit.listProviders()) {
      process.stdout.write(`${provider.id}\t${provider.name}\t${provider.authMethods.join(",")}\n`);
    }
    return 0;
  }

  if (command === "login") {
    prompts.intro("AI Auth Kit login");
    const credential = await loginWithPrompts(kit, args[0]);
    if (!credential) {
      prompts.cancel("Cancelled");
      return 1;
    }
    prompts.outro(`Saved ${credential.type} credential`);
    return 0;
  }

  if (command === "models") {
    const provider = args[0] ? kit.getProvider(args[0]) : await pickProvider(kit, "Select provider to list models");
    if (!provider) return 1;
    for (const model of kit.listModels(provider.id)) {
      process.stdout.write(`${model.id}\t${model.name}\n`);
    }
    return 0;
  }

  if (command === "use") {
    const provider = args[0] ? kit.getProvider(args[0]) : await pickProvider(kit);
    if (!provider) return 1;
    const model = args[1] ? kit.getModel(provider.id, args[1]) : await pickModel(kit, provider.id);
    if (!model) return 1;
    await kit.selectModel(provider.id, model.id);
    prompts.outro(`Selected ${provider.id}/${model.id}`);
    return 0;
  }

  if (command === "current") {
    const selection = await kit.resolveSelection();
    if (!selection) {
      process.stdout.write("No model selected\n");
      return 1;
    }
    process.stdout.write(`${selection.provider.id}/${selection.model.id}\n`);
    return 0;
  }

  if (command === "doctor") {
    const state = await kit.readState();
    const selection = await kit.resolveSelection();
    process.stdout.write(`project=${projectName}\n`);
    process.stdout.write(`providers=${kit.listProviders().length}\n`);
    process.stdout.write(`credentials=${Object.keys(state.credentials).length}\n`);
    process.stdout.write(`selected=${selection ? `${selection.provider.id}/${selection.model.id}` : "none"}\n`);
    process.stdout.write(`config=${kit.store.path ?? "custom"}\n`);
    process.stdout.write(`secrets=${kit.secrets.path ?? "custom"}\n`);
    return 0;
  }

  if (command === "path") {
    process.stdout.write(`${kit.store.path ?? "custom"}\n`);
    return 0;
  }

  process.stderr.write(`Unknown command: ${command}\n\n${usage()}`);
  return 2;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
