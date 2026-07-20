import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

describe("landing copy and link contract", () => {
  test("uses approved copy and the existing default-branch license", async () => {
    // Given: the authored landing page
    const landing = await Bun.file(resolve(root, "src/pages/index.astro")).text()

    // When: public copy and the license destination are inspected
    // Then: concise approved copy replaces stale library and storage language
    expect(landing).toContain("Provider auth / Model selection")
    expect(landing).toContain("Provider authentication and model selection for host tools.")
    expect(landing).not.toContain("Library / TypeScript")
    expect(landing).not.toContain("private project storage")

    // Then: the MIT footer targets the repository's resolvable default branch
    expect(landing).toContain("https://github.com/abran-labs/ai-auth-kit/blob/master/LICENSE")
    expect(landing).not.toContain("https://github.com/abran-labs/ai-auth-kit/blob/main/LICENSE")
  })
})
