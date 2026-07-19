# Dependency policy

AI Auth Kit has two direct runtime npm dependencies:

| Dependency | Active source imports | Reason | License | Locked version |
| --- | --- | --- | --- | --- |
| `@clack/prompts` | `src/picker.ts` | Host-owned interactive picker prompts | MIT | `1.7.0` |
| `zod` | State, auth policy, catalog, cache, and CLIProxyAPI boundary modules | Untrusted boundary parsing | MIT | `4.4.3` |

`@oh-my-pi/pi-ai` and `ai` aren't imported runtime dependencies or supported peers.

## Seven-day resolution cooldown

`bunfig.toml` sets `minimumReleaseAge = 604800`. Bun applies that cooldown while selecting a new npm package version. It doesn't retroactively inspect the publication age of unchanged entries in `bun.lock`, and Git dependencies aren't covered. There is no production exclusion in `minimumReleaseAgeExcludes`.

Deterministic existing installs use Bun's frozen-lock mode. `scripts/audit-dependencies.ts` checks direct imports, installed metadata, and exact lock versions. With a previous lock supplied as its baseline, it requests registry publication metadata only for changed npm resolutions and rejects missing, malformed, or younger-than-policy metadata. `scripts/qa-minimum-release-age.ts` proves the policy against a disposable local registry and never changes production exclusions.

The cooldown reduces exposure to newly published dependency versions. It isn't a vulnerability scan, publisher identity proof, or substitute for lock review. Changes to direct dependencies still need source, license, lock, and age review.
