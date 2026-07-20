import { OLLAMA_README_ROW } from "./provider-doc-contract"

export const EXACT_LIBRARY_INSTALL = "bun add @abran-labs/ai-auth-kit@1.0.0"
export const EXACT_SKILL_INSTALL =
  "curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.0.0/install-agent-skill.sh | sh"
export const LIBRARY_PREPUBLICATION_LABEL =
  "Pending: use this exact command after npm package @abran-labs/ai-auth-kit@1.0.0 is published."
export const SKILL_PREPUBLICATION_LABEL =
  "Pending: use this exact command after the agent-skill-v1.0.0 release asset is uploaded."
export const CLIPROXYAPI_REPOSITORY = "router-for-me/CLIProxyAPI"
export const CLIPROXYAPI_REPOSITORY_URL = `https://github.com/${CLIPROXYAPI_REPOSITORY}` as const
export const EXACT_README_PROMISE = "AI authentication, made easy."
export const README_BANNER_MARKDOWN =
  "![AI Auth Kit banner showing an abstract authorization card beside the product name](.github/assets/ai-auth-kit-banner.svg)"

type ReadmeProviderClaim = {
  readonly evidence: readonly string[]
  readonly label: string
  readonly row: string
}

export const README_PROVIDER_CLAIMS = [
  {
    label: "OpenAI",
    row: "| OpenAI | API key, `OPENAI_API_KEY`, or built-in account OAuth |",
    evidence: ["src/auth-policy-registry.ts"],
  },
  {
    label: "GitHub Copilot",
    row: "| GitHub Copilot | `GITHUB_TOKEN`, `GH_TOKEN`, or `COPILOT_GITHUB_TOKEN`, plus built-in account OAuth |",
    evidence: ["src/auth-policy-registry.ts"],
  },
  {
    label: "Anthropic",
    row: "| Anthropic | API key, `ANTHROPIC_API_KEY`, or optional CLIProxyAPI account auth |",
    evidence: ["src/auth-policy-registry.ts", "src/external-auth.ts"],
  },
  {
    label: "Google",
    row: "| Google | API key, supported Gemini/Google environment variables, or optional CLIProxyAPI account auth |",
    evidence: ["src/auth-policy-registry.ts", "src/external-auth.ts"],
  },
  {
    label: "Other catalog providers",
    row: "| Other catalog providers | API key or environment auth only when source environment names exist |",
    evidence: ["src/auth-policy-registry.ts", "src/catalog-adapter.ts"],
  },
  {
    label: "Ollama compatibility entry",
    row: OLLAMA_README_ROW,
    evidence: ["src/catalog-adapter.ts"],
  },
] as const satisfies readonly ReadmeProviderClaim[]

const requiredReadmeOrder = [
  README_BANNER_MARKDOWN,
  "# AI Auth Kit",
  EXACT_README_PROMISE,
  "## Install",
  LIBRARY_PREPUBLICATION_LABEL,
  "## Install the skill",
  SKILL_PREPUBLICATION_LABEL,
  "## Providers",
  "## Why AI Auth Kit",
  "## Links",
] as const

const forbiddenReadmePhrases = [
  "private project storage",
  "Library package vs agent skill",
  "60-second quickstart",
  "Import from the package root",
  "bun.lock",
] as const

export function readmeContractViolations(source: string): readonly string[] {
  const visibleSource = source.replace(/<!--[\s\S]*?(?:-->|$)/g, "")
  const violations: string[] = []
  const orderedPositions = requiredReadmeOrder.map((value) => visibleSource.indexOf(value))
  const contentOrdered = orderedPositions.every(
    (position, index) =>
      position >= 0 && (index === 0 || position > (orderedPositions[index - 1] ?? -1)),
  )
  if (!contentOrdered) violations.push("README.md: content is out of required order")
  if (!visibleSource.includes(EXACT_LIBRARY_INSTALL))
    violations.push("README.md: missing visible library install command")
  if (!visibleSource.includes(EXACT_SKILL_INSTALL))
    violations.push("README.md: missing visible agent skill install command")
  if (!visibleSource.includes(LIBRARY_PREPUBLICATION_LABEL))
    violations.push("README.md: missing visible npm prepublication label")
  if (!visibleSource.includes(SKILL_PREPUBLICATION_LABEL))
    violations.push("README.md: missing visible agent-skill prepublication label")
  if (!visibleSource.includes(`[CLIProxyAPI](${CLIPROXYAPI_REPOSITORY_URL})`))
    violations.push("README.md: missing visible CLIProxyAPI repository link")
  for (const phrase of forbiddenReadmePhrases) {
    if (visibleSource.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`README.md: forbidden detail ${phrase}`)
    }
  }
  for (const claim of README_PROVIDER_CLAIMS) {
    if (!visibleSource.includes(claim.row))
      violations.push(`README.md: missing provider claim ${claim.label}`)
  }
  const providersStart = visibleSource.indexOf("## Providers")
  const providersEnd = visibleSource.indexOf("\n## ", providersStart + 1)
  const providerSection =
    providersStart < 0
      ? ""
      : visibleSource.slice(providersStart, providersEnd < 0 ? undefined : providersEnd)
  const allowedLabels = new Set<string>(README_PROVIDER_CLAIMS.map((claim) => claim.label))
  for (const match of providerSection.matchAll(/^\|\s*([^|]+?)\s*\|.*\|$/gm)) {
    const label = match[1]?.trim() ?? ""
    if (label !== "Provider" && !/^-+$/.test(label) && !allowedLabels.has(label))
      violations.push(`README.md: unsupported provider claim ${label}`)
  }
  return violations
}
