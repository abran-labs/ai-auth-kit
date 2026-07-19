# AI Auth Kit 1.0.0 agent skill release checklist

- [ ] Run `bun run scripts/pack-agent-skill.ts --check` for the versioned archive, manifest, and payload hashes.
- [ ] Run `bun test test/agent-skill-contract.test.ts test/agent-skill-installer.test.ts`.
- [ ] Confirm the curl installer rejects unsafe archive entries and user-owned targets.
- [ ] Confirm package/runtime docs use exactly `bun add @abran-labs/ai-auth-kit@1.0.0`.
- [ ] Do not upload the skill release, publish npm, push tags, or deploy Pages without separate approval.
