import { resolve } from "node:path"

export type ValidationMode = "source" | "dist"
export type BuildLocation = {
  readonly site: string
  readonly base: string
}

const requiredSourcePaths = [
  "DESIGN.md",
  "astro.config.ts",
  "src/content.config.ts",
  "src/pages/index.astro",
  "src/pages/robots.txt.ts",
  "src/styles/global.css",
  "src/styles/landing.css",
  "src/styles/landing-components.css",
  "src/styles/landing-responsive.css",
  "tests/capture-state-qa.ts",
  "tests/interaction-qa.ts",
  "tests/theme-keyboard-qa.ts",
  "src/content/docs/start/index.md",
  "src/content/docs/start/quickstart.md",
  "src/content/docs/guides/library.md",
  "src/content/docs/guides/cli.md",
  "src/content/docs/guides/providers-auth.md",
  "src/content/docs/guides/storage-privacy.md",
  "src/content/docs/guides/models-dev.md",
  "src/content/docs/guides/cliproxy.md",
  "src/content/docs/reference/api.md",
  "src/content/docs/reference/cli.md",
  "src/content/docs/reference/security.md",
  "src/content/docs/reference/linux-installer.md",
  "public/social-card.svg",
  "public/social-card.png",
  "../.github/workflows/pages.yml",
] as const

const designSections = [
  "## 1. Atmosphere & Identity",
  "## 2. Color",
  "## 3. Typography",
  "## 4. Spacing & Layout",
  "## 5. Components",
  "## 6. Motion & Interaction",
  "## 7. Depth & Surface",
] as const

const forbiddenAuthoredTerms = [
  "codegraph",
  "lorem ipsum",
  "todo",
  "glassmorphism",
  "tailwind",
  String.fromCodePoint(102, 105, 101, 108, 100, 110, 111, 116, 101, 115),
] as const

const authoredTextPatterns = [
  "src/**/*.astro",
  "src/**/*.css",
  "src/**/*.md",
  "public/**/*.svg",
  "public/**/*.txt",
  "public/**/*.xml",
  "public/**/*.json",
  "public/**/*.webmanifest",
] as const

async function readExisting(root: string, path: string): Promise<string | undefined> {
  const file = Bun.file(resolve(root, path))
  if (!(await file.exists())) return undefined
  return file.text()
}

function requireText(
  violations: string[],
  source: string | undefined,
  path: string,
  expected: string,
): void {
  if (source !== undefined && !source.includes(expected)) {
    violations.push(`${path}: missing ${expected}`)
  }
}

async function readAuthoredText(root: string): Promise<readonly [string, string][]> {
  const paths = new Set<string>()
  for (const pattern of authoredTextPatterns) {
    const glob = new Bun.Glob(pattern)
    for await (const path of glob.scan({ cwd: root, onlyFiles: true })) paths.add(path)
  }
  const sortedPaths = [...paths].toSorted()
  return Promise.all(
    sortedPaths.map(
      async (path): Promise<[string, string]> => [path, await Bun.file(resolve(root, path)).text()],
    ),
  )
}

export function normalizeBase(value: string | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (trimmed === "" || trimmed === "/") return "/"
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`
}

export function readBuildLocation(): BuildLocation {
  return {
    site: process.env["SITE"]?.trim() || "https://example.com",
    base: normalizeBase(process.env["BASE"]),
  }
}

export async function validateSource(root: string): Promise<readonly string[]> {
  const violations: string[] = []
  for (const path of requiredSourcePaths) {
    if (!(await Bun.file(resolve(root, path)).exists())) violations.push(`${path}: missing`)
  }

  const design = await readExisting(root, "DESIGN.md")
  for (const section of designSections) requireText(violations, design, "DESIGN.md", section)

  const config = await readExisting(root, "astro.config.ts")
  requireText(violations, config, "astro.config.ts", "@astrojs/starlight")
  requireText(violations, config, "astro.config.ts", "@astrojs/sitemap")
  requireText(violations, config, "astro.config.ts", "normalizeBase")

  const landing = await readExisting(root, "src/pages/index.astro")
  const metadataMarkers = [
    'rel="canonical"',
    "og:title",
    "og:image:alt",
    "og:image:type",
    "og:image:width",
    "og:image:height",
    "twitter:card",
    "twitter:image:alt",
    "social-card.png",
    "BASE_URL",
  ] as const
  for (const marker of metadataMarkers) {
    requireText(violations, landing, "src/pages/index.astro", marker)
  }

  const workflowPath = "../.github/workflows/pages.yml"
  const workflow = await readExisting(root, workflowPath)
  for (const marker of [
    "contents: read",
    "pages: write",
    "id-token: write",
    "bun install --frozen-lockfile",
    "bunx playwright install --with-deps chromium",
    "persist-credentials: false",
    "actions/upload-pages-artifact",
    "actions/deploy-pages",
    "BASE: /ai-auth-kit/",
    "branches: [master]",
    "bun run qa:browser && bun run validate:dist",
  ] as const) {
    requireText(violations, workflow, workflowPath, marker)
  }

  for (const [path, source] of await readAuthoredText(root)) {
    const normalizedSource = source.toLowerCase()
    for (const term of forbiddenAuthoredTerms) {
      if (normalizedSource.includes(term)) {
        violations.push(`${path}: forbidden authored term ${term}`)
      }
    }
  }

  return violations.toSorted()
}

export async function validateDist(
  root: string,
  location: BuildLocation,
): Promise<readonly string[]> {
  const violations: string[] = []
  const distRoot = resolve(root, "dist")
  const requiredDistPaths = [
    "index.html",
    "start/index.html",
    "start/quickstart/index.html",
    "guides/library/index.html",
    "guides/cli/index.html",
    "guides/providers-auth/index.html",
    "guides/storage-privacy/index.html",
    "guides/models-dev/index.html",
    "guides/cliproxy/index.html",
    "reference/api/index.html",
    "reference/cli/index.html",
    "reference/security/index.html",
    "reference/linux-installer/index.html",
    "robots.txt",
    "sitemap-index.xml",
    "pagefind/pagefind.js",
    "social-card.png",
  ] as const
  for (const path of requiredDistPaths) {
    if (!(await Bun.file(resolve(distRoot, path)).exists()))
      violations.push(`dist/${path}: missing`)
  }

  const landing = await readExisting(distRoot, "index.html")
  const robots = await readExisting(distRoot, "robots.txt")
  const canonical = new URL(location.base, location.site).href
  const sitemap = new URL(`${location.base}sitemap-index.xml`, location.site).href
  requireText(violations, landing, "dist/index.html", canonical)
  for (const marker of [
    "twitter:card",
    "twitter:image:alt",
    "og:image:alt",
    "og:image:type",
    "og:image:width",
    "og:image:height",
    `${location.base}social-card.png`,
  ] as const) {
    requireText(violations, landing, "dist/index.html", marker)
  }
  requireText(violations, robots, "dist/robots.txt", sitemap)

  if (landing !== undefined && location.base !== "/") {
    for (const match of landing.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const authoredUrl = match[1]
      if (authoredUrl !== undefined && !authoredUrl.startsWith(location.base)) {
        violations.push(`dist/index.html: URL escapes base: ${authoredUrl}`)
      }
    }
  }

  return violations.toSorted()
}
