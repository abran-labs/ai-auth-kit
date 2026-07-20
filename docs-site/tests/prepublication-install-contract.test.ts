import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"

const repositoryRoot = resolve(import.meta.dir, "../..")
const libraryCommand = "bun add @abran-labs/ai-auth-kit@1.0.0"
const skillCommand =
  "curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh"
const libraryPending =
  "Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.0.0 is published."
const skillPending =
  "Pending: use this exact command after the agent-skill-v1.0.0 release asset is uploaded."
const npmUnavailable = "The npm endpoint currently returns 404."
const publicSurfaces = [
  { path: "README.md", libraryCount: 1, skillCount: 1 },
  { path: "docs-site/src/pages/index.astro", libraryCount: 2, skillCount: 1 },
  { path: "docs-site/src/content/docs/start/quickstart.md", libraryCount: 1, skillCount: 0 },
  { path: "docs-site/src/content/docs/guides/library.md", libraryCount: 1, skillCount: 0 },
  { path: "docs-site/src/content/docs/guides/agent-skill.md", libraryCount: 2, skillCount: 1 },
  { path: "skills/ai-auth-kit/SKILL.md", libraryCount: 2, skillCount: 0 },
] as const
const durableLanguageSurfaces = [
  "docs-site/tests/template-contract.test.ts",
  "test/agent-skill-contract.test.ts",
] as const
const obsoleteLanguage = [
  ["owned", "by", "Todo3"].join(" "),
  ["Given", "the", "released", "skill"].join(" "),
  ["exact", "public", "npm", "release"].join(" "),
] as const

function occurrenceCount(source: string, value: string): number {
  return source.split(value).length - 1
}

describe("prepublication install contract", () => {
  test("pairs every exact command with its pending publication condition", async () => {
    // Given: every public surface that presents an exact install command
    const sources = await Promise.all(
      publicSurfaces.map(async (surface) => ({
        ...surface,
        source: await Bun.file(resolve(repositoryRoot, surface.path)).text(),
      })),
    )

    // When: command and pending-label occurrences are counted per surface
    // Then: each command has one honest availability label
    for (const surface of sources) {
      expect(occurrenceCount(surface.source, libraryCommand)).toBe(surface.libraryCount)
      expect(occurrenceCount(surface.source, libraryPending)).toBe(surface.libraryCount)
      expect(occurrenceCount(surface.source, skillCommand)).toBe(surface.skillCount)
      expect(occurrenceCount(surface.source, skillPending)).toBe(surface.skillCount)
    }
  })

  test("keeps public site metadata scoped to provider authentication and model selection", async () => {
    // Given: the Starlight configuration
    const config = await Bun.file(resolve(repositoryRoot, "docs-site/astro.config.ts")).text()

    // When: public metadata is inspected
    // Then: it uses the approved description without private-storage wording
    expect(config).toContain(
      'description: "Provider authentication and model selection for host tools."',
    )
    expect(config).not.toContain("private project storage")
  })

  test("marks both skill package commands unavailable while npm returns 404", async () => {
    // Given: the bundled skill's two exact package install commands
    const skill = await Bun.file(resolve(repositoryRoot, "skills/ai-auth-kit/SKILL.md")).text()

    // When: current npm availability wording is counted
    // Then: each command carries the same explicit 404 condition
    expect(occurrenceCount(skill, libraryCommand)).toBe(2)
    expect(occurrenceCount(skill, npmUnavailable)).toBe(2)
  })

  test("uses durable behavior and availability language in contracts", async () => {
    // Given: contracts that protect the skill payload and exact install commands
    const contracts = (
      await Promise.all(
        durableLanguageSurfaces.map((path) => Bun.file(resolve(repositoryRoot, path)).text()),
      )
    ).join("\n")

    // When: historical task and publication wording is inspected
    // Then: contracts describe durable behavior instead
    for (const phrase of obsoleteLanguage) expect(contracts).not.toContain(phrase)
  })

  test("keeps pending labels while both publication endpoints are unavailable", async () => {
    // Given: the exact npm version and skill-installer publication endpoints
    const [npmResponse, skillResponse] = await Promise.all([
      fetch("https://registry.npmjs.org/@abran-labs%2Fai-auth-kit/1.0.0"),
      fetch(
        "https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh",
        { redirect: "follow" },
      ),
    ])

    // When: their current publication status is observed
    // Then: both remain unavailable, so public pending labels are required
    expect(npmResponse.status).toBe(404)
    expect(skillResponse.status).toBe(404)
  })
})
