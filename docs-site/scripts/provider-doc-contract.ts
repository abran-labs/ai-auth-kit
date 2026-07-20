export const OLLAMA_README_ROW =
  "| Ollama compatibility entry | No auth, or environment auth via `OLLAMA_API_KEY`; no API-key method |"
export const OLLAMA_GUIDE_ROW = "| Ollama compatibility entry | No | `OLLAMA_API_KEY` | No |"
export const OLLAMA_GUIDE_STATEMENT =
  "Ollama supports no auth, or environment auth via `OLLAMA_API_KEY`; no API-key method."

const PROVIDERS_GUIDE_PATH = "src/content/docs/guides/providers-auth.md"

export function providerGuideContractViolations(
  source: string,
  sourcePath: string,
): readonly string[] {
  if (sourcePath !== PROVIDERS_GUIDE_PATH || !source.includes("## Supported choices")) return []

  const violations: string[] = []
  const row = source.split("\n").find((line) => line.startsWith("| Ollama compatibility entry |"))
  const cells = row?.split("|").map((cell) => cell.trim()) ?? []
  if (cells[2] !== "No") violations.push(`${sourcePath}: Ollama API key must be No`)
  if (cells[3] !== "`OLLAMA_API_KEY`") {
    violations.push(`${sourcePath}: Ollama environment must be OLLAMA_API_KEY`)
  }
  if (cells[4] !== "No") violations.push(`${sourcePath}: Ollama account login must be No`)
  if (!source.includes(OLLAMA_GUIDE_STATEMENT)) {
    violations.push(`${sourcePath}: missing Ollama no-auth/environment statement`)
  }
  return violations
}
