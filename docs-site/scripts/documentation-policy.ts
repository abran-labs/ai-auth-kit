import { posix } from "node:path"
import { appearanceContractViolations } from "./appearance-contract"
import { providerGuideContractViolations } from "./provider-doc-contract"
import { readmeContractViolations } from "./readme-contract"

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
const documentationSourcePrefix = "src/content/docs/"
const maintainedRoutePaths = new Set<string>(
  maintainedDocumentationRoutes.map((route) => route.path),
)

function isInternalLink(target: string): boolean {
  return !target.startsWith("#") && !target.startsWith("/") && !target.includes(":")
}

function renderedRoute(target: string, sourcePath: string): string | undefined {
  if (!sourcePath.startsWith(documentationSourcePrefix)) return undefined
  const documentPath = sourcePath.slice(documentationSourcePrefix.length).replace(/\.md$/, "")
  const sourceRoute = documentPath.endsWith("/index") ? posix.dirname(documentPath) : documentPath
  const route = posix.normalize(posix.join(sourceRoute, target.replace(/\/+$/, "")))
  return `${route.replace(/^\/+|\/+$/g, "")}/`
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
    const route = isInternalLink(target) ? renderedRoute(target, sourcePath) : undefined
    if (route !== undefined && !maintainedRoutePaths.has(route)) {
      violations.add(`${sourcePath}: broken rendered route ${route}`)
    }
  }
  if (sourcePath === "README.md")
    for (const violation of readmeContractViolations(source)) violations.add(violation)
  if (sourcePath === "DESIGN.md")
    for (const violation of appearanceContractViolations(source)) violations.add(violation)
  for (const violation of providerGuideContractViolations(source, sourcePath)) {
    violations.add(violation)
  }
  return [...violations]
}
