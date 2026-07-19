import { posix } from "node:path"

export type DocumentationRoute = {
  readonly commandBlock: boolean
  readonly name: string
  readonly path: string
  readonly tocLabel?: string
}

export const maintainedDocumentationRoutes = [
  { commandBlock: true, name: "landing", path: "" },
  { commandBlock: false, name: "start", path: "start/", tocLabel: "Overview" },
  { commandBlock: true, name: "quickstart", path: "start/quickstart/", tocLabel: "Overview" },
  { commandBlock: false, name: "library", path: "guides/library/" },
  { commandBlock: false, name: "providers-auth", path: "guides/providers-auth/" },
  { commandBlock: false, name: "storage-privacy", path: "guides/storage-privacy/" },
  { commandBlock: false, name: "models-dev", path: "guides/models-dev/" },
  { commandBlock: false, name: "cliproxy", path: "guides/cliproxy/" },
  { commandBlock: true, name: "agent-skill", path: "guides/agent-skill/" },
  { commandBlock: false, name: "api", path: "reference/api/" },
  { commandBlock: false, name: "security", path: "reference/security/" },
] as const satisfies readonly DocumentationRoute[]

const genericCliClaims = [
  /\binteractive command-line tool\b/i,
  /\bCLI\s+(?:--project|guide|runs|command|tool)\b/i,
  /\bai-auth-kit\s+(?:init|providers|login|models|use|current|doctor|catalog|path)\b/i,
] as const

const installerOrBinaryReleaseClaims = [
  /\b(?:download|install|use|run)\s+(?:the\s+)?(?:installer|binary(?:\s+release)?|release artifact)/i,
  /\b(?:installer|binary release|release artifact)s?\s+(?:are|is)(?:\s+still)?\s+(?:available|shipped|pending|planned)/i,
  /\bships?\s+(?:an?\s+)?(?:installer|executable|binary)/i,
] as const

const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g
const sourceDocumentPaths = new Set([
  "src/content/docs/start/index.md",
  "src/content/docs/start/quickstart.md",
  "src/content/docs/guides/library.md",
  "src/content/docs/guides/providers-auth.md",
  "src/content/docs/guides/storage-privacy.md",
  "src/content/docs/guides/models-dev.md",
  "src/content/docs/guides/cliproxy.md",
  "src/content/docs/guides/agent-skill.md",
  "src/content/docs/reference/api.md",
  "src/content/docs/reference/security.md",
])

function isInternalLink(target: string): boolean {
  return !target.startsWith("#") && !target.startsWith("/") && !target.includes(":")
}

function isKnownDocument(target: string, sourcePath: string): boolean {
  const location = posix.normalize(
    posix.join(posix.dirname(sourcePath), target.replace(/\/+$/, "")),
  )
  return (
    sourceDocumentPaths.has(`${location}.md`) ||
    sourceDocumentPaths.has(posix.join(location, "index.md"))
  )
}

export function documentationViolations(source: string, sourcePath: string): readonly string[] {
  const violations = new Set<string>()
  for (const claim of genericCliClaims) {
    if (claim.test(source)) violations.add(`${sourcePath}: forbidden generic CLI claim`)
  }
  for (const claim of installerOrBinaryReleaseClaims) {
    if (claim.test(source)) {
      violations.add(`${sourcePath}: forbidden installer or binary-release claim`)
    }
  }
  for (const match of source.matchAll(markdownLink)) {
    const target = (match[1] ?? "").split("#")[0] ?? ""
    if (isInternalLink(target) && !isKnownDocument(target, sourcePath)) {
      violations.add(`${sourcePath}: broken internal link ${target}`)
    }
  }
  return [...violations]
}
