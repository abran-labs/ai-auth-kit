import { describe, expect, test } from "bun:test"
import { normalizeBase } from "../scripts/contracts"

describe("base normalization", () => {
  test.each([
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["ai-auth-kit", "/ai-auth-kit/"],
    ["/ai-auth-kit", "/ai-auth-kit/"],
    ["///ai-auth-kit///", "/ai-auth-kit/"],
  ] as const)("normalizes %p to %p", (input, expected) => {
    // Given: an environment-style base value
    // When: the value crosses the configuration boundary
    const result = normalizeBase(input)

    // Then: exactly one leading and trailing slash remains
    expect(result).toBe(expected)
  })
})
