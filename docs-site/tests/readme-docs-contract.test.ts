import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { documentationViolations } from "../scripts/documentation-policy"
import {
  EXACT_README_PROMISE,
  EXACT_SKILL_INSTALL,
  LIBRARY_BUN_INSTALL,
  LIBRARY_NPM_INSTALL,
  README_BANNER_MARKDOWN,
} from "../scripts/readme-contract"

const repositoryRoot = resolve(import.meta.dir, "../..")
const exactLibraryInstall = LIBRARY_BUN_INSTALL
const exactNpmInstall = LIBRARY_NPM_INSTALL
const exactSkillInstall = EXACT_SKILL_INSTALL
const validReadme = `${README_BANNER_MARKDOWN}
# AI Auth Kit
${EXACT_README_PROMISE}
## Install
${exactLibraryInstall}
${exactNpmInstall}
## Install the skill
${exactSkillInstall}
## Docs
[Documentation](docs-site/src/content/docs/start/index.md)`
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
  test("accepts canonical README claims", () =>
    expect(documentationViolations(validReadme, "README.md")).toEqual([]))
  test("rejects closed hidden canonical values", () => {
    const source = validReadme
      .replace(exactLibraryInstall, "wrong")
      .replace(exactNpmInstall, "wrong")
      .replace(exactSkillInstall, "wrong")
      .concat(`\n<!-- ${exactLibraryInstall}\n${exactNpmInstall}\n${exactSkillInstall} -->`)
    expect(documentationViolations(source, "README.md")).toEqual([
      "README.md: missing visible bun library install command",
      "README.md: missing visible npm library install command",
      "README.md: missing visible agent skill install command",
    ])
  })
  test("rejects activation-flow drift", () => {
    const source = validReadme
      .replace("## Install the skill", "## Pending")
      .replace("## Docs", "## Install the skill")
      .replace("## Pending", "## Docs")
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
        sha256: "b9f0e55006f899100aa34e138113240584e12d20ff6679269d3c1eab2e69c3ac",
      },
      {
        path: ".github/assets/ai-auth-kit-banner.png",
        sha256: "a4f4a63f05ee3acc66d084afdaed84c22534c185270ae1ae40d3161ddd40dfbc",
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
    expect(provenance).toContain("resized to 1800×380 on 2026-10-12")
    expect(provenance).toContain("rendered from the SVG with rsvg-convert")
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
      .replace(exactNpmInstall, "wrong")
      .replace(exactSkillInstall, "wrong")
      .concat(`\n<!-- ${exactLibraryInstall}\n${exactNpmInstall}\n${exactSkillInstall}`)

    // When: rendered README content is validated through EOF
    const violations = documentationViolations(source, "README.md")

    // Then: hidden canonical values do not satisfy the contract
    expect(violations).toEqual([
      "README.md: missing visible bun library install command",
      "README.md: missing visible npm library install command",
      "README.md: missing visible agent skill install command",
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
