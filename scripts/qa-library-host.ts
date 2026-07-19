import * as prompts from "@clack/prompts";
import type { AutocompleteOptions } from "@clack/prompts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PROVIDERS, createAuthKit, pickProvider, projectStorage } from "../src/index.js";

async function selectFirstAutocomplete<Value>(options: AutocompleteOptions<Value>): Promise<Value | symbol> {
  if (!Array.isArray(options.options)) throw new Error("Host adapter requires static options");
  const option = options.options[0];
  if (option === undefined) throw new Error("Host adapter received no options");
  return option.value;
}

const directory = await mkdtemp(join(tmpdir(), "ai-auth-kit-library-host-"));
try {
  const kit = createAuthKit({
    providers: DEFAULT_PROVIDERS,
    storage: projectStorage("host-tool", { rootDir: directory }),
  });
  const provider = await pickProvider(kit, "Host provider", {
    ...prompts,
    autocomplete: selectFirstAutocomplete,
    info: () => undefined,
  });
  if (provider === undefined) throw new Error("Host picker did not return a provider");
  const model = kit.listModels(provider.id)[0];
  if (model === undefined) throw new Error("Host provider did not return a model");
  process.stdout.write(`host-library-qa provider=${provider.id} model=${model.id}\n`);
} finally {
  await rm(directory, { force: true, recursive: true });
}
