import { expect, test } from "bun:test";
import { validateGitDependency } from "../scripts/git-dependency.js";

const sha = "0123456789abcdef0123456789abcdef01234567";
const otherSha = "fedcba9876543210fedcba9876543210fedcba98";

function lock(resolution: string): string {
  return JSON.stringify({ packages: { "@abran-labs/ai-auth-kit": [`@abran-labs/ai-auth-kit@${resolution}`, "", {}] } });
}

test("Given a public full-SHA dependency and matching lock, when validated, then the immutable consumer contract passes", () => {
  expect(() => validateGitDependency({ spec: `github:abran-labs/ai-auth-kit#${sha}`, lockSource: lock(sha) })).not.toThrow();
});

test("Given mutable, abbreviated, local-file, or workspace dependency specs, when validated, then each fails with an actionable immutable-reference error", () => {
  for (const spec of ["github:abran-labs/ai-auth-kit#master", "github:abran-labs/ai-auth-kit#v0.2.0", `github:abran-labs/ai-auth-kit#${sha.slice(0, 12)}`, "file:../ai-auth-kit", "workspace:*", "link:../ai-auth-kit"]) {
    expect(() => validateGitDependency({ spec, lockSource: lock(sha) })).toThrow("immutable dependency must be");
  }
});

test("Given a test-only local Git URL, when an independently supplied exact SHA matches its lock, then it passes but mismatched resolution fails", () => {
  const spec = `git+http://127.0.0.1:12345/package.git#${sha}`;
  expect(() => validateGitDependency({ spec, lockSource: lock(sha), expectedSha: sha, allowTestLocalGit: true })).not.toThrow();
  expect(() => validateGitDependency({ spec, lockSource: lock(otherSha), expectedSha: sha, allowTestLocalGit: true })).toThrow("resolved lock SHA mismatch");
});
