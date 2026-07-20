import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { documentationViolations } from "../scripts/documentation-policy"

const repositoryRoot = resolve(import.meta.dir, "../..")
const guidePath = "src/content/docs/guides/providers-auth.md"
const exactReadmeRow =
  "| Ollama compatibility entry | No auth, or environment auth via `OLLAMA_API_KEY`; no API-key method |"
const exactGuideRow = "| Ollama compatibility entry | No | `OLLAMA_API_KEY` | No |"
const exactGuideStatement =
  "Ollama supports no auth, or environment auth via `OLLAMA_API_KEY`; no API-key method."
const validGuide = `## Supported choices\n\n${exactGuideRow}\n\n${exactGuideStatement}`
const emptyCatalog = {
  provenance: {
    sourceUrl: "https://models.dev/api.json",
    sourceSchemaCommit: "0".repeat(40),
    capturedAt: "2026-07-20T00:00:00.000Z",
    etag: null,
    sourceContentSha256: "0".repeat(64),
  },
  providers: [],
} as const

describe("Ollama documentation contract", () => {
  test("matches runtime none and environment availability", async () => {
    // Given: public README/guide claims and the runtime provider catalog
    const [readme, guide] = await Promise.all([
      Bun.file(resolve(repositoryRoot, "README.md")).text(),
      Bun.file(resolve(repositoryRoot, "docs-site", guidePath)).text(),
    ])
    const runtimeProbe = Bun.spawnSync({
      cmd: [
        process.execPath,
        "-e",
        `import { providersFromCatalog } from "./src/catalog-adapter.ts";
const catalog = ${JSON.stringify(emptyCatalog)};
const ollama = providersFromCatalog(catalog).find(({ id }) => id === "ollama");
console.log(ollama?.authMethods.join(",") ?? "missing");`,
      ],
      cwd: repositoryRoot,
    })

    // When: documented methods are compared with runtime availability
    // Then: no-auth and environment remain available without API-key/account login
    expect(runtimeProbe.exitCode, runtimeProbe.stderr.toString()).toBe(0)
    expect(runtimeProbe.stdout.toString().trim()).toBe("none,env")
    expect(readme).toContain(exactReadmeRow)
    expect(guide).toContain(exactGuideRow)
    expect(guide).toContain(exactGuideStatement)
  })

  test("rejects omitted no-auth availability", () => {
    // Given: otherwise factual guidance that drops the no-auth method
    const source = validGuide.replace("no auth, or ", "")

    // When: provider documentation policy runs
    const violations = documentationViolations(source, guidePath)

    // Then: omission is rejected
    expect(violations).toEqual([`${guidePath}: missing Ollama no-auth/environment statement`])
  })

  test("rejects Optional API-key labeling", () => {
    // Given: Ollama is mislabeled with an optional API-key method
    const source = validGuide.replace(
      "| No | `OLLAMA_API_KEY` | No |",
      "| Optional | `OLLAMA_API_KEY` | No |",
    )

    // When: provider documentation policy runs
    const violations = documentationViolations(source, guidePath)

    // Then: the unsupported API-key method is rejected
    expect(violations).toEqual([`${guidePath}: Ollama API key must be No`])
  })

  test("rejects no-auth as account-login labeling", () => {
    // Given: no-auth is placed in the account-login column
    const source = validGuide.replace(
      "| No | `OLLAMA_API_KEY` | No |",
      "| No | `OLLAMA_API_KEY` | No auth also available |",
    )

    // When: provider documentation policy runs
    const violations = documentationViolations(source, guidePath)

    // Then: the nonexistent account-login method is rejected
    expect(violations).toEqual([`${guidePath}: Ollama account login must be No`])
  })
})
