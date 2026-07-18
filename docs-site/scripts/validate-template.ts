import { resolve } from "node:path"
import { readBuildLocation, type ValidationMode, validateDist, validateSource } from "./contracts"

class ValidationModeError extends Error {
  readonly value: string | undefined

  constructor(value: string | undefined) {
    super(`Expected validation mode "source" or "dist"; received ${value ?? "nothing"}`)
    this.name = "ValidationModeError"
    this.value = value
  }
}

function parseMode(value: string | undefined): ValidationMode {
  if (value === "source" || value === "dist") return value
  throw new ValidationModeError(value)
}

const root = resolve(import.meta.dir, "..")
const mode = parseMode(process.argv[2])
const violations =
  mode === "source" ? await validateSource(root) : await validateDist(root, readBuildLocation())

if (violations.length > 0) {
  console.error(`Template ${mode} validation failed:`)
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(`Template ${mode} validation passed.`)
