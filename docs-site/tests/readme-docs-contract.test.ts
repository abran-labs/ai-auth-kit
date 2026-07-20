import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { documentationViolations } from "../scripts/documentation-policy"
import {
  EXACT_README_PROMISE,
  LIBRARY_PREPUBLICATION_LABEL,
  README_BANNER_MARKDOWN,
  SKILL_PREPUBLICATION_LABEL,
} from "../scripts/readme-contract"

const repositoryRoot = resolve(import.meta.dir, "../..")
const exactLibraryInstall = "bun add @abran-labs/ai-auth-kit@1.0.0"
const exactSkillInstall =
  "curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh"
const cliProxyApiLink = "[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)"
const factualOllamaRow =
  "| Ollama compatibility entry | No auth, or environment auth via `OLLAMA_API_KEY`; no API-key method |"
const legacyOllamaRow = "| Ollama compatibility entry | No auth or `OLLAMA_API_KEY` |"
const providerRows = [
  "| OpenAI | API key, `OPENAI_API_KEY`, or built-in account OAuth |",
  "| GitHub Copilot | `GITHUB_TOKEN`, `GH_TOKEN`, or `COPILOT_GITHUB_TOKEN`, plus built-in account OAuth |",
  "| Anthropic | API key, `ANTHROPIC_API_KEY`, or optional CLIProxyAPI account auth |",
  "| Google | API key, supported Gemini/Google environment variables, or optional CLIProxyAPI account auth |",
  "| Other catalog providers | API key or environment auth only when source environment names exist |",
  factualOllamaRow,
] as const
const validReadme = `${README_BANNER_MARKDOWN}
# AI Auth Kit
${EXACT_README_PROMISE}
## Install
${LIBRARY_PREPUBLICATION_LABEL}
${exactLibraryInstall}
## Install the skill
${SKILL_PREPUBLICATION_LABEL}
${exactSkillInstall}
## Providers
| Provider | Available choices |
| --- | --- |
${providerRows.join("\n")}
${cliProxyApiLink}
## Why AI Auth Kit
Reviewed policy.
## Links
[Docs](https://abran-labs.github.io/ai-auth-kit/)`
const validAppearance = `### Appearance menu
- System maps to internal \`auto\`, persists the empty string \`""\` under \`starlight-theme\`, and resolves \`data-theme\`.
- Light persists exactly \`light\`; Dark persists exactly \`dark\`. Missing or invalid values normalize to System.
- Tab Enter Space ArrowUp ArrowDown Home End Escape; Escape restores focus to the button.
- Pointer selection, reduced motion, and mobile behavior remain equivalent.`

describe("README and Appearance contract", () => {
  test("characterizes runtime-grounded provider and current theme behavior", async () => {
    // Given: reviewed runtime policy, catalog adapter, external auth boundary, and landing
    const [policy, catalog, externalAuth, cliProxyApi, landing] = await Promise.all(
      [
        "src/auth-policy-registry.ts",
        "src/catalog-adapter.ts",
        "src/external-auth.ts",
        "src/cliproxyapi.ts",
        "docs-site/src/pages/index.astro",
      ].map((path) => Bun.file(resolve(repositoryRoot, path)).text()),
    )

    // When: retained documentation claims are compared with runtime source
    const runtimeSource = `${policy}\n${catalog}\n${externalAuth}`

    // Then: every retained provider and CLIProxyAPI boundary has direct evidence
    for (const provider of ["openai", "github-copilot", "anthropic", "google"] as const)
      expect(runtimeSource).toContain(provider)
    expect(catalog).toContain("provider.authMethods.length > 0")
    expect(externalAuth).toContain('new Set(["anthropic", "google"])')
    expect(cliProxyApi).toContain('CLIPROXYAPI_REPO = "router-for-me/CLIProxyAPI"')
    expect(landing).toContain(
      'const preference = stored === "light" || stored === "dark" ? stored : "auto"',
    )
  })
  test("documents Ollama without an API-key auth method", async () => {
    // Given: runtime compatibility policy and the public README
    const [catalog, readme] = await Promise.all([
      Bun.file(resolve(repositoryRoot, "src/catalog-adapter.ts")).text(),
      Bun.file(resolve(repositoryRoot, "README.md")).text(),
    ])

    // When: Ollama's public claim is compared with its runtime methods
    // Then: none and environment auth cannot be mislabeled as API-key auth
    expect(catalog).toContain('authMethods: ["none", "env"]')
    expect(readme).toContain(factualOllamaRow)
    expect(readme).not.toContain(legacyOllamaRow)
  })
  test("accepts canonical README claims", () =>
    expect(documentationViolations(validReadme, "README.md")).toEqual([]))
  test("rejects closed hidden canonical values", () => {
    const source = validReadme
      .replace(exactLibraryInstall, "wrong")
      .replace(exactSkillInstall, "wrong")
      .replace(cliProxyApiLink, "CLIProxyAPI")
      .concat(`\n<!-- ${exactLibraryInstall}\n${exactSkillInstall}\n${cliProxyApiLink} -->`)
    expect(documentationViolations(source, "README.md")).toEqual([
      "README.md: missing visible library install command",
      "README.md: missing visible agent skill install command",
      "README.md: missing visible CLIProxyAPI repository link",
    ])
  })
  test("rejects exact install commands without honest prepublication labels", () => {
    const source = validReadme
      .replace(LIBRARY_PREPUBLICATION_LABEL, "")
      .replace(SKILL_PREPUBLICATION_LABEL, "")
    expect(documentationViolations(source, "README.md")).toEqual([
      "README.md: content is out of required order",
      "README.md: missing visible npm prepublication label",
      "README.md: missing visible agent-skill prepublication label",
    ])
  })
  test("rejects unsupported provider rows", () => {
    const source = validReadme.replace(
      providerRows[0],
      `${providerRows[0]}\n| Mistral | Built-in account OAuth |`,
    )
    expect(documentationViolations(source, "README.md")).toEqual([
      "README.md: unsupported provider claim Mistral",
    ])
  })
  test("rejects activation-flow drift", () => {
    const source = validReadme
      .replace("## Install the skill", "## Pending")
      .replace("## Providers", "## Install the skill")
      .replace("## Pending", "## Providers")
    expect(documentationViolations(source, "README.md")).toContain(
      "README.md: content is out of required order",
    )
  })
  test("rejects implementation detail in the activation surface", () => {
    // Given: a valid activation flow with details reserved for deeper docs
    const source = `${validReadme}\nImport from the package root and commit bun.lock.`

    // When: the concise README contract is evaluated
    const violations = documentationViolations(source, "README.md")

    // Then: internal setup guidance cannot return to the activation surface
    expect(violations).toEqual([
      "README.md: forbidden detail Import from the package root",
      "README.md: forbidden detail bun.lock",
    ])
  })
  test("locks the rendered hero and byte-identical banner companions", async () => {
    // Given: the repository README and supplied banner destinations
    const readme = await Bun.file(resolve(repositoryRoot, "README.md")).text()
    const provenance = await Bun.file(
      resolve(repositoryRoot, ".github/assets/ai-auth-kit-banner.provenance.md"),
    ).text()
    const assets = [
      {
        path: ".github/assets/ai-auth-kit-banner.svg",
        sha256: "10c6c810beca9dd52fc55856c55e397d8579df028eeb500a26d9b06c318ecf10",
      },
      {
        path: ".github/assets/ai-auth-kit-banner.png",
        sha256: "2623598d32ed278ea5d06213fa55f2c3213433242db342bbdb785877daccbcce",
      },
    ] as const

    // When: the visible hero and committed asset bytes are inspected
    const digests = await Promise.all(
      assets.map(async ({ path }) => {
        const bytes = await Bun.file(resolve(repositoryRoot, path)).arrayBuffer()
        return new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
      }),
    )

    // Then: SVG is the relative primary hero and both supplied files remain exact
    expect(readme.startsWith(`${README_BANNER_MARKDOWN}\n\n# AI Auth Kit`)).toBe(true)
    expect(digests).toEqual(assets.map(({ sha256 }) => sha256))
    for (const { sha256 } of assets) expect(provenance).toContain(sha256)
    expect(provenance).toContain("Supplied source comparison evidence")
    expect(provenance).toContain("source comparisons cannot be repeated")
  })
  test("accepts exact Appearance semantics", () =>
    expect(documentationViolations(validAppearance, "DESIGN.md")).toEqual([]))
  test("rejects native select and no-keyboard contradictions", () => {
    const source = `${validAppearance}\n- Use a native select.\n- The Appearance menu has no keyboard support.`
    expect(documentationViolations(source, "DESIGN.md")).toEqual([
      "DESIGN.md: Appearance menu must not be a native select",
      "DESIGN.md: Appearance menu contradicts keyboard support",
    ])
  })
  test("rejects replacement System auto persistence", () => {
    const source = validAppearance.replace(
      'persists the empty string `""`',
      "persists the literal `auto` value",
    )
    expect(documentationViolations(source, "DESIGN.md")).toEqual([
      "DESIGN.md: System must persist an empty starlight-theme value",
    ])
  })
  test("rejects canonical values hidden by an unclosed comment through EOF", () => {
    // Given: canonical values occur only after an unclosed HTML comment opener
    const source = validReadme
      .replace(exactLibraryInstall, "wrong")
      .replace(exactSkillInstall, "wrong")
      .replace(cliProxyApiLink, "CLIProxyAPI")
      .concat(`\n<!-- ${exactLibraryInstall}\n${exactSkillInstall}\n${cliProxyApiLink}`)

    // When: rendered README content is validated through EOF
    const violations = documentationViolations(source, "README.md")

    // Then: hidden canonical values do not satisfy the contract
    expect(violations).toEqual([
      "README.md: missing visible library install command",
      "README.md: missing visible agent skill install command",
      "README.md: missing visible CLIProxyAPI repository link",
    ])
  })
  test("rejects additive System auto persistence", () => {
    // Given: valid empty persistence remains alongside an affirmative auto contradiction
    const source = `${validAppearance}\n- System also persists \`auto\` under \`starlight-theme\`.`

    // When: the complete Appearance contract is validated
    const violations = documentationViolations(source, "DESIGN.md")

    // Then: the additive contradiction is rejected
    expect(violations).toEqual(["DESIGN.md: System must not persist auto"])
  })
  test("accepts explicit negation of System auto persistence", () => {
    // Given: valid semantics explicitly state that auto is not persisted
    const source = `${validAppearance}\n- System does not persist \`auto\`; it remains internal.`

    // When: the complete Appearance contract is validated
    const violations = documentationViolations(source, "DESIGN.md")

    // Then: negated guidance is not a contradiction
    expect(violations).toEqual([])
  })
})
