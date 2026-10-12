export const LIBRARY_BUN_INSTALL = "bun add @abran-labs/ai-auth-kit"
export const LIBRARY_NPM_INSTALL = "npm install @abran-labs/ai-auth-kit"
export const EXACT_SKILL_INSTALL =
  "curl -fsSL https://github.com/abran-labs/ai-auth-kit/releases/download/agent-skill-v1.1.0/install-agent-skill.sh | sh"
export const EXACT_README_PROMISE = "AI authentication, made easy."
export const README_BANNER_MARKDOWN =
  "![AI Auth Kit banner showing an abstract authorization card beside the product name](.github/assets/ai-auth-kit-banner.svg)"

const requiredReadmeOrder = [
  README_BANNER_MARKDOWN,
  "# AI Auth Kit",
  EXACT_README_PROMISE,
  "## Install",
  "## Install the skill",
  "## Docs",
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
  if (!visibleSource.includes(LIBRARY_BUN_INSTALL))
    violations.push("README.md: missing visible bun library install command")
  if (!visibleSource.includes(LIBRARY_NPM_INSTALL))
    violations.push("README.md: missing visible npm library install command")
  if (!visibleSource.includes(EXACT_SKILL_INSTALL))
    violations.push("README.md: missing visible agent skill install command")
  for (const phrase of forbiddenReadmePhrases) {
    if (visibleSource.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`README.md: forbidden detail ${phrase}`)
    }
  }
  return violations
}
