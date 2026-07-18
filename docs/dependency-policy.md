# Dependency policy

AI Auth Kit retains only two runtime npm dependencies:

| Dependency | Active source imports | Why it is retained | License | Locked version |
| --- | --- | --- | --- | --- |
| `@clack/prompts` | `src/cli.ts`, `src/picker.ts` | Interactive CLI and model picker prompts | MIT | `1.7.0` |
| `zod` | `src/schema.ts`, `src/auth-policy-registry.ts`, `src/catalog-normalize.ts`, `src/catalog-source-schema.ts`, `src/catalog-cache.ts`, `src/cliproxyapi-cache.ts`, `src/cliproxyapi-release.ts` | Persisted state, release payload, and catalog boundary validation | MIT | `4.4.3` |

`@oh-my-pi/pi-ai` and `ai` are neither imported nor supported peers. Their stale optional-peer metadata is intentionally absent.

## Seven-day npm cooldown

`bunfig.toml` configures Bun with `minimumReleaseAge = 604800`. Bun applies this only while resolving a **new npm version**. It does not retroactively age-audit `bun.lock`, and it does not cover Git dependencies. This repository has no production exemption in `minimumReleaseAgeExcludes`; temporary fixture exclusion is exercised only by QA to prove an exemption must be explicit.

Use frozen locks for deterministic existing installs:

```bash
bun install --frozen-lockfile
```

Audit direct runtime dependency imports, installed package metadata, exact lock versions, and optionally newly changed lock resolutions:

```bash
bun run audit:dependencies
bun run audit:dependencies --baseline /path/to/previous-bun.lock
```

The baseline form obtains registry publish metadata for every changed npm resolution and fails closed for missing, malformed, or too-young metadata. Run the disposable local-registry proof before changing release-age policy:

```bash
bun run qa:minimum-release-age
```
