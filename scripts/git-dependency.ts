type GitDependencyInput = {
  readonly spec: string;
  readonly lockSource: string;
  readonly expectedSha?: string;
  readonly allowTestLocalGit?: boolean;
};

const packageName = "@abran-labs/ai-auth-kit";
const fullSha = /^[0-9a-f]{40}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return Object.fromEntries(Object.entries(value));
  throw new Error(`${label} must be an object`);
}

function requiredSha(input: GitDependencyInput): string {
  const publicMatch = /^github:abran-labs\/ai-auth-kit#([0-9a-f]{40})$/.exec(input.spec);
  if (publicMatch?.[1] !== undefined) return publicMatch[1];
  const localMatch = /^git\+(?:file|https?|ssh):\/\/[^#]+#([0-9a-f]{40})$/.exec(input.spec);
  if (input.allowTestLocalGit && localMatch?.[1] !== undefined && input.expectedSha !== undefined && fullSha.test(input.expectedSha) && localMatch[1] === input.expectedSha) {
    return input.expectedSha;
  }
  throw new Error(`immutable dependency must be github:abran-labs/ai-auth-kit#<40 lowercase hex>; received ${input.spec}`);
}

function lockedResolution(lockSource: string): string {
  const parsed: unknown = JSON.parse(lockSource.replace(/,(\s*[}\]])/g, "$1"));
  const packages = record(parsed, "Bun lock")["packages"];
  const entry = record(packages, "Bun lock packages")[packageName];
  if (!Array.isArray(entry) || typeof entry[0] !== "string") throw new Error(`Bun lock is missing ${packageName}`);
  return entry[0];
}

export function validateGitDependency(input: GitDependencyInput): void {
  const sha = requiredSha(input);
  const resolution = lockedResolution(input.lockSource);
  if (!resolution.includes(sha)) throw new Error(`resolved lock SHA mismatch: expected ${sha}; lock has ${resolution}`);
}
