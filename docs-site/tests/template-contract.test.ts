import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

const requiredFiles = [
  "DESIGN.md",
  "astro.config.ts",
  "src/pages/index.astro",
  "src/pages/robots.txt.ts",
  "src/styles/global.css",
  "src/styles/landing-components.css",
  "src/styles/landing-responsive.css",
  "tests/capture-state-qa.ts",
  "tests/interaction-qa.ts",
  "tests/theme-keyboard-qa.ts",
  "src/content/docs/start/index.md",
  "src/content/docs/start/quickstart.md",
  "src/content/docs/guides/library.md",
  "src/content/docs/reference/api.md",
  "public/social-card.svg",
  "../.github/workflows/pages.yml",
] as const

const forbiddenTerms = [
  "CodeGraph",
  String.fromCodePoint(102, 105, 101, 108, 100, 110, 111, 116, 101, 115),
  "lorem ipsum",
  "TODO",
  "tailwind",
  "glassmorphism",
] as const

describe("template contract", () => {
  test("contains every maintained source file", async () => {
    // Given: the maintained template root
    // When: each required contract path is inspected
    const existence = await Promise.all(
      requiredFiles.map((path) => Bun.file(resolve(root, path)).exists()),
    )

    // Then: every path exists
    expect(existence).toEqual(requiredFiles.map(() => true))
  })

  test("keeps forbidden identity and placeholder terms out of authored UI", async () => {
    // Given: authored landing and stylesheet files
    const authoredPaths = ["src/pages/index.astro", "src/styles/global.css"] as const

    // When: their source is read
    const authoredSource = (
      await Promise.all(authoredPaths.map((path) => Bun.file(resolve(root, path)).text()))
    ).join("\n")

    // Then: no forbidden term is present
    for (const term of forbiddenTerms) {
      expect(authoredSource.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })

  test("declares non-root-base build coverage", async () => {
    // Given: project scripts and workflow
    const packageSource = await Bun.file(resolve(root, "package.json")).text()
    const packageManifest: unknown = JSON.parse(packageSource)

    // When: the source contract validator checks package metadata
    const serialized = JSON.stringify(packageManifest)

    // Then: dist validation is an explicit script
    expect(serialized).toContain("validate:dist")
  })

  test("keeps landing accessibility and theme continuity in source", async () => {
    // Given: the custom landing source outside Starlight's page shell
    const landing = await Bun.file(resolve(root, "src/pages/index.astro")).text()

    // When: its accessibility and theme contracts are inspected
    // Then: it shares Starlight state and exposes keyboard navigation controls
    expect(landing).toContain('localStorage.getItem("starlight-theme")')
    expect(landing).toContain('class="skip-link"')
    expect(landing).toContain('aria-label="Color theme"')
    expect(landing).toContain(
      "bun add --ignore-scripts --exact github:abran-labs/ai-auth-kit#adcb364fa086ec1a854d2b412a5efbd530595b98",
    )
    expect(landing).not.toContain("--exact \\")
  })

  test("gates deployment on browser QA", async () => {
    // Given: the Pages workflow
    const workflow = await Bun.file(resolve(root, "../.github/workflows/pages.yml")).text()

    // When: the build command is inspected
    // Then: browser QA runs before the artifact is uploaded
    expect(workflow).toContain("bun run qa:browser")
    expect(workflow).toContain("bun install --frozen-lockfile")
    expect(workflow).toContain("bunx playwright install --with-deps chromium")
    expect(workflow).toContain("persist-credentials: false")
    expect(workflow).toContain("actions/upload-pages-artifact@")
  })

  test("documents current CLI and runtime API behavior", async () => {
    // Given: public CLI and start documentation
    const [reference, guide, start] = await Promise.all([
      Bun.file(resolve(root, "src/content/docs/reference/cli.md")).text(),
      Bun.file(resolve(root, "src/content/docs/guides/cli.md")).text(),
      Bun.file(resolve(root, "src/content/docs/start/index.md")).text(),
    ])

    // When: claims are compared with the implementation contract
    // Then: output and required provider input are described exactly
    expect(reference).toContain("Print the selected provider and model")
    expect(reference).not.toContain("auth state")
    expect(guide.replaceAll("\n", " ")).toContain(
      "project counts, selected model, and storage paths",
    )
    expect(start).toContain("runtimeAuth(providerId)")
  })

  test("keeps install-command scrolling explicit", async () => {
    // Given: install commands wider than the landing and docs reading columns
    const [landing, quickstart] = await Promise.all([
      Bun.file(resolve(root, "src/pages/index.astro")).text(),
      Bun.file(resolve(root, "src/content/docs/start/quickstart.md")).text(),
    ])

    // When: their adjacent instructions are inspected
    // Then: each surface tells readers how to reveal the full pinned SHA
    expect(landing).toContain("Scroll sideways to read the full pinned SHA")
    expect(quickstart).toContain("Scroll the command block sideways")
    expect(quickstart).not.toContain("On narrow screens")
  })

  test("settles top-of-page TOC state before visual capture", async () => {
    // Given: interactions can leave Starlight's scroll-spy on a later heading
    const [browserQa, captureStateQa] = await Promise.all([
      Bun.file(resolve(root, "tests/browser-qa.ts")).text(),
      Bun.file(resolve(root, "tests/capture-state-qa.ts")).text(),
    ])

    // When: the screenshot sequence is inspected
    // Then: it awaits the route-specific initial TOC state before capture
    expect(browserQa).toContain("settleCaptureState")
    expect(captureStateQa).toContain('start: "Overview"')
    expect(captureStateQa).toContain('quickstart: "Overview"')
    expect(captureStateQa).toContain("document.fonts.ready")
    expect(captureStateQa).toContain("animation.cancel()")
    expect(captureStateQa).toContain("requestAnimationFrame")
    expect(captureStateQa).toContain('a[aria-current="true"]')
  })

  test("locks focused wordmark and current TOC visual states", async () => {
    // Given: narrow landing headers and Starlight TOC links share constrained surfaces
    const [landingStyles, globalStyles, interactionQa, captureStateQa] = await Promise.all([
      Bun.file(resolve(root, "src/styles/landing.css")).text(),
      Bun.file(resolve(root, "src/styles/global.css")).text(),
      Bun.file(resolve(root, "tests/interaction-qa.ts")).text(),
      Bun.file(resolve(root, "tests/capture-state-qa.ts")).text(),
    ])

    // When: focus and current-location styling contracts are inspected
    // Then: wrapping and muted-current regressions are guarded in CSS and browser QA
    expect(landingStyles).toContain("white-space: nowrap")
    expect(landingStyles).toContain("flex-shrink: 0")
    expect(globalStyles).toContain('.right-sidebar a[aria-current="true"]')
    expect(globalStyles).toContain("color: var(--accent-strong)")
    expect(interactionQa).toContain("getClientRects")
    expect(captureStateQa).toContain('probe.style.color = "var(--accent-strong)"')
    expect(captureStateQa).toContain("getComputedStyle(probe).color")
  })
})
