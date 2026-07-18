import { expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createProjectAuthKit } from "./kit.js";
import { pickModel } from "./picker.js";
import type { PromptAdapter } from "./picker.js";

const SOURCE = {
  provider: {
    id: "provider",
    name: "Provider",
    env: ["PROVIDER_API_KEY"],
    models: {
      "live-model": { id: "live-model", name: "Live Model" },
      "old-model": { id: "old-model", name: "Old Model", status: "deprecated" },
    },
  },
};

function promptChoosing(value: string): PromptAdapter {
  const autocomplete: PromptAdapter["autocomplete"] = async (options) => {
    if (typeof options.options === "function") return Symbol("cancel");
    return options.options.find((option) => option.value === value)?.value ?? Symbol("cancel");
  };
  const select: PromptAdapter["select"] = async (options) =>
    options.options.find((option) => option.value === value)?.value ?? Symbol("cancel");
  return {
    isCancel: (candidate: unknown): candidate is symbol => typeof candidate === "symbol",
    autocomplete,
    select,
    confirm: mock<PromptAdapter["confirm"]>().mockResolvedValue(true),
    password: mock<PromptAdapter["password"]>().mockResolvedValue("unused"),
    info: () => undefined,
  };
}

test("same installed commit sees refreshed model", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-integration-"));
  let source = JSON.stringify(SOURCE);
  const kit = createProjectAuthKit("integration", {
    rootDir: root,
    catalog: {
      cacheRoot: root,
      fetch: async () => new Response(source),
    },
  });

  expect(kit.listProviders().some((provider) => provider.id === "provider")).toBe(false);
  await kit.refreshCatalog();
  source = JSON.stringify({
    ...SOURCE,
    provider: {
      ...SOURCE.provider,
      models: {
        ...SOURCE.provider.models,
        "new-model": { id: "new-model", name: "New Model" },
      },
    },
  });
  await kit.refreshCatalog({ force: true });

  expect(kit.getModel("provider", "new-model").name).toBe("New Model");
  await rm(root, { recursive: true, force: true });
});

test("picker awaits refresh and removed model hidden", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-picker-"));
  const kit = createProjectAuthKit("picker", {
    rootDir: root,
    catalog: { cacheRoot: root, fetch: async () => new Response(JSON.stringify(SOURCE)) },
  });

  const model = await pickModel(kit, "provider", "Select model", promptChoosing("live-model"));

  expect(model?.id).toBe("live-model");
  expect(kit.listModels("provider").map((item) => item.id)).not.toContain("old-model");
  await rm(root, { recursive: true, force: true });
});

test("historical selection survives removal", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-auth-kit-historical-"));
  const kit = createProjectAuthKit("historical", {
    rootDir: root,
    catalog: { cacheRoot: root, fetch: async () => new Response(JSON.stringify(SOURCE)) },
  });
  await kit.refreshCatalog();
  await kit.selectModel("provider", "live-model");
  const before = await readFile(kit.store.path ?? "", "utf8");
  const offline = createProjectAuthKit("historical", {
    rootDir: root,
    catalog: { cacheRoot: root, fetch: async () => { throw new TypeError("offline"); } },
  });

  const selected = await offline.resolveSelection();

  expect(selected?.provider.id).toBe("provider");
  expect(selected?.model.id).toBe("live-model");
  expect(await readFile(offline.store.path ?? "", "utf8")).toBe(before);
  await rm(root, { recursive: true, force: true });
});
