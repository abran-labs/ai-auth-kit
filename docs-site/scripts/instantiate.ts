import { cp, mkdir } from "node:fs/promises"
import { basename, resolve, sep } from "node:path"

class TargetPathError extends Error {
  readonly target: string | undefined

  constructor(target: string | undefined, reason: string) {
    super(`Cannot instantiate target ${target ?? "<missing>"}: ${reason}`)
    this.name = "TargetPathError"
    this.target = target
  }
}

const ignoredNames = new Set(["node_modules", "dist", ".astro", "test-results"])
const source = resolve(import.meta.dir, "..")
const targetArgument = process.argv[2]

if (targetArgument === undefined || targetArgument.trim() === "") {
  throw new TargetPathError(targetArgument, "provide a destination path")
}

const target = resolve(targetArgument)
if (target === source) throw new TargetPathError(targetArgument, "destination equals template")
if (target.startsWith(`${source}${sep}`)) {
  throw new TargetPathError(targetArgument, "destination is nested inside template")
}

await mkdir(target, { recursive: false })
await cp(source, target, {
  recursive: true,
  filter: (path) => !ignoredNames.has(basename(path)),
})

console.log(`Instantiated Starlight paper template at ${target}`)
