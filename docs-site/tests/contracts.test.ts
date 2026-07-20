import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import {
  type BuildLocation,
  documentationViolations,
  maintainedDocumentationRoutes,
  validateDist,
  validateSource,
} from "../scripts/contracts"

const root = resolve(import.meta.dir, "..")
const projectLocation = {
  site: "https://example.github.io",
  base: "/ai-auth-kit/",
} satisfies BuildLocation

describe("contract validator", () => {
  test("reports generic executable claims and broken internal documentation links", () => {
    const genericCliClaim = ["The", "CLI runs", "`ai-auth-kit login`."].join(" ")
    const deletedGuidePath = ["..", "guides", "cli"].join("/")
    expect(
      documentationViolations(
        `${genericCliClaim} Read the [removed guide](${deletedGuidePath}/).`,
        "src/content/docs/start/index.md",
      ),
    ).toEqual([
      "src/content/docs/start/index.md: forbidden generic CLI claim",
      "src/content/docs/start/index.md: broken rendered route guides/cli/",
    ])
  })

  test("rejects source-valid links whose rendered browser routes do not exist", () => {
    // Given: relative Markdown links that point at source files but render below the current route
    const oldQuickstartLinks = [
      "[Storage](../guides/storage-privacy/)",
      "[Library](../guides/library/)",
      "[Providers](../guides/providers-auth/)",
      "[Agent skill](../guides/agent-skill/)",
    ].join("\n")
    const oldCliProxyLink = "[CLIProxyAPI](./cliproxy/)"

    // When: documentation policy resolves links as a browser would
    const violations = [
      ...documentationViolations(oldQuickstartLinks, "src/content/docs/start/quickstart.md"),
      ...documentationViolations(oldCliProxyLink, "src/content/docs/guides/providers-auth.md"),
    ]

    // Then: all five rendered 404 routes are rejected
    expect(violations).toEqual([
      "src/content/docs/start/quickstart.md: broken rendered route start/guides/storage-privacy/",
      "src/content/docs/start/quickstart.md: broken rendered route start/guides/library/",
      "src/content/docs/start/quickstart.md: broken rendered route start/guides/providers-auth/",
      "src/content/docs/start/quickstart.md: broken rendered route start/guides/agent-skill/",
      "src/content/docs/guides/providers-auth.md: broken rendered route guides/providers-auth/cliproxy/",
    ])
  })

  test("reports generic installer and binary-release claims", () => {
    expect(
      documentationViolations(
        "Download the installer binary release artifact for your platform.",
        "src/content/docs/start/index.md",
      ),
    ).toEqual(["src/content/docs/start/index.md: forbidden installer or binary-release claim"])
  })

  test("rejects the exact stale public-installer release claim", () => {
    expect(
      documentationViolations(
        "Public installer release artifacts are still pending.",
        "src/content/docs/start/index.md",
      ),
    ).toEqual(["src/content/docs/start/index.md: forbidden installer or binary-release claim"])
  })

  test("enumerates every maintained route for browser capture", () => {
    expect(maintainedDocumentationRoutes).toHaveLength(11)
  })

  test("keeps docs activation concise with exact commands and canonical adapter provenance", async () => {
    // Given: the maintained docs navigation and activation pages
    const [config, start, quickstart, agentGuide, providers, cliProxy] = await Promise.all([
      Bun.file(resolve(root, "astro.config.ts")).text(),
      Bun.file(resolve(root, "src/content/docs/start/index.md")).text(),
      Bun.file(resolve(root, "src/content/docs/start/quickstart.md")).text(),
      Bun.file(resolve(root, "src/content/docs/guides/agent-skill.md")).text(),
      Bun.file(resolve(root, "src/content/docs/guides/providers-auth.md")).text(),
      Bun.file(resolve(root, "src/content/docs/guides/cliproxy.md")).text(),
    ])

    // When: visible labels, commands, and adapter links are inspected together
    const scopedSource = [config, start, quickstart, agentGuide, providers, cliProxy].join("\n")

    // Then: concise labels and exact activation/provenance contracts remain
    expect(scopedSource).not.toMatch(/60-second quickstart|Start in 60 seconds/i)
    expect(quickstart).toContain("bun add @abran-labs/ai-auth-kit@1.0.0")
    expect(agentGuide).toContain(
      "curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh",
    )
    expect(cliProxy).toContain("[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)")
    expect(providers).toContain("only for Anthropic or Google account auth")
  })

  test("accepts the maintained source contract", async () => {
    // Given: the complete maintained template
    // When: source validation runs
    const violations = await validateSource(root)

    // Then: no contract violation remains
    expect(violations).toEqual([])
  })

  test("reports missing source paths in stable order", async () => {
    // Given: an empty source directory
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "starlight-source-"))
    try {
      // When: source validation runs
      const violations = await validateSource(temporaryRoot)

      // Then: failures are deterministic and actionable
      expect(violations.length).toBeGreaterThan(0)
      expect(violations).toEqual([...violations].toSorted())
      expect(violations[0]).toContain(": missing")
    } finally {
      await rm(temporaryRoot, { recursive: true })
    }
  })

  test("accepts a complete non-root distribution", async () => {
    // Given: a minimal distribution satisfying every output contract
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "starlight-dist-"))
    const distRoot = resolve(temporaryRoot, "dist")
    const routeDirectories = [
      "start",
      "start/quickstart",
      "guides/library",
      "guides/providers-auth",
      "guides/storage-privacy",
      "guides/models-dev",
      "guides/cliproxy",
      "guides/agent-skill",
      "reference/api",
      "reference/security",
      "pagefind",
    ] as const
    try {
      await Promise.all(
        routeDirectories.map((path) => mkdir(resolve(distRoot, path), { recursive: true })),
      )
      const canonical = "https://example.github.io/ai-auth-kit/"
      const sitemap = "https://example.github.io/ai-auth-kit/sitemap-index.xml"
      await Promise.all([
        writeFile(
          resolve(distRoot, "index.html"),
          `<link rel="canonical" href="${canonical}"><meta name="twitter:card"><meta name="twitter:image:alt"><meta property="og:image:alt"><meta property="og:image:type"><meta property="og:image:width"><meta property="og:image:height"><meta property="og:image" content="/ai-auth-kit/social-card.png">`,
        ),
        writeFile(resolve(distRoot, "start/index.html"), "start"),
        writeFile(resolve(distRoot, "start/quickstart/index.html"), "quickstart"),
        writeFile(resolve(distRoot, "guides/library/index.html"), "library"),
        writeFile(resolve(distRoot, "guides/providers-auth/index.html"), "providers"),
        writeFile(resolve(distRoot, "guides/storage-privacy/index.html"), "storage"),
        writeFile(resolve(distRoot, "guides/models-dev/index.html"), "catalog"),
        writeFile(resolve(distRoot, "guides/cliproxy/index.html"), "adapter"),
        writeFile(resolve(distRoot, "guides/agent-skill/index.html"), "agent skill"),
        writeFile(resolve(distRoot, "reference/api/index.html"), "api"),
        writeFile(resolve(distRoot, "reference/security/index.html"), "security"),
        writeFile(resolve(distRoot, "robots.txt"), `Sitemap: ${sitemap}`),
        writeFile(resolve(distRoot, "sitemap-index.xml"), "<sitemapindex></sitemapindex>"),
        writeFile(resolve(distRoot, "pagefind/pagefind.js"), "export {}"),
        writeFile(resolve(distRoot, "social-card.png"), new Uint8Array([137, 80, 78, 71])),
      ])

      // When: dist validation receives explicit build provenance
      const violations = await validateDist(temporaryRoot, projectLocation)

      // Then: non-root output passes deterministically
      expect(violations).toEqual([])
    } finally {
      await rm(temporaryRoot, { recursive: true })
    }
  })

  test("finds forbidden identity text in nested authored Markdown", async () => {
    // Given: a nested authored document containing prohibited identity text
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "starlight-originality-"))
    try {
      await mkdir(resolve(temporaryRoot, "src/content/docs/nested"), { recursive: true })
      await writeFile(
        resolve(temporaryRoot, "src/content/docs/nested/page.md"),
        "A copied CodeGraph identity.",
      )

      // When: source validation scans authored text recursively
      const violations = await validateSource(temporaryRoot)

      // Then: the nested file is named without attempting to decode binary assets
      expect(violations).toContain(
        "src/content/docs/nested/page.md: forbidden authored term codegraph",
      )
    } finally {
      await rm(temporaryRoot, { recursive: true })
    }
  })
})
