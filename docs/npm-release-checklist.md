# AI Auth Kit 1.0.0 npm release checklist

This checklist stages npm-facing documentation and workflow policy only. Do not publish npm, create
or replace a GitHub release, push a tag, or deploy the docs site without separate approval.

## Version synchronization

- [ ] `package.json` is exact library version `1.0.0` under the separately reviewed package task.
- [ ] `README.md` and every maintained `docs-site` route install only
  `@abran-labs/ai-auth-kit@1.0.0`.
- [ ] `skills/ai-auth-kit/VERSION` is `1.0.0`.
- [ ] `skills/ai-auth-kit/SKILL.md` declares skill/library `1.0.0` and requires first-use checking.
- [ ] `skills/ai-auth-kit/scripts/check-library-version.mjs` expects `1.0.0` and reports exact
  `bun add @abran-labs/ai-auth-kit@1.0.0` remediation without updating.

## One-tarball npm workflow

- [ ] `npm-release.yml` checks out an existing source tag, records its commit SHA, runs frozen install,
  tests, build, and `pack:verify` once.
- [ ] The package job uploads exactly one verified tarball under its original filename with
  `source-tag.sha`, SHA-256, SRI, and inventory.
- [ ] The protected `npm-production` job downloads that artifact and checks source SHA, SHA-256, SRI,
  inventory, official registry, absent version/tag, provenance, and the exact-tarball dry run. Token auth
  additionally checks principal, package scope authority, and organization membership; GitHub OIDC checks
  the repository, workflow, job, and declared environment context without claiming npm configuration is local.
- [ ] Publishing requires workflow input `I_HAVE_EXPLICIT_FINAL_NPM_APPROVAL` after fresh user approval.
- [ ] Publish command is `npm publish "$RELEASE_TARBALL" --access public --provenance`; it never packs
  a directory or creates a GitHub release asset.

## Verification

- [ ] `bun test test/npm-release-contract.test.ts test/agent-skill-contract.test.ts`
- [ ] `sh -n scripts/npm-preflight.sh scripts/verify-release-artifact.sh`
- [ ] `actionlint .github/workflows/npm-release.yml`
- [ ] `bun run check`, `bun test`, and `bun run build` in the library.
- [ ] README/docs scan contains no generic `ai-auth-kit` command claim, npm range, mutable package
  install, or Git package install guidance.

## Irreversible gates

- [ ] Do not publish `@abran-labs/ai-auth-kit@1.0.0` until explicit final npm approval is freshly entered
  as `I_HAVE_EXPLICIT_FINAL_NPM_APPROVAL` and `npm-production` protection approves the run.
- [ ] Do not create/upload GitHub release assets or tag during this staging task.
- [ ] Do not deploy the docs site during this staging task.
- [ ] Configure required reviewers for external `npm-production` and `github-pages` environments in
  GitHub before a remote release or deployment. This repository cannot prove those remote settings.
- [ ] If npm credentials or trusted-publisher configuration are unavailable, preserve the fail-closed
  preflight result and complete npm setup; never claim authority or bypass the gate.
- [ ] Configure npm Trusted Publisher for GitHub Actions exactly: owner `abran-labs`, repository
  `ai-auth-kit`, workflow filename `npm-release.yml`, environment `npm-production`. GitHub OIDC context
  checks are only local signals; npm validates this tuple during `npm publish --provenance`.
