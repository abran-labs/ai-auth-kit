export const DOCUMENT_PATHS = [
	"README.md",
	"docs/canonical-contract-0.2.0.md",
	"docs/dependency-policy.md",
	"docs/documentation-qa.md",
	"docs/installer-manager-trust.md",
] as const;

export type ShellBlock = {
	readonly document: string;
	readonly id: string;
	readonly command: string;
};

export type DocumentationPolicy = {
	readonly supportedCliFlags: ReadonlySet<string>;
};

const FULL_SHA = /^[0-9a-f]{40}$/;
const IMMUTABLE_PLACEHOLDER = "<40-lowercase-hex-commit>";
const GIT_REFERENCE = /github:abran-labs\/ai-auth-kit#([^\s"'`]+)/g;
const MISSING_GIT_REFERENCE = /github:abran-labs\/ai-auth-kit#?(?=[\s"'`]|$)/g;
const NONCANONICAL_GIT_REFERENCE = /(?:git\+(?:https?|ssh|file):\/\/[^\s"'`]*abran-labs\/ai-auth-kit[^\s"'`]*|https:\/\/github\.com\/abran-labs\/ai-auth-kit(?:\.git)?#[^\s"'`]*)/gi;
const RAW_INSTALLER_REFERENCE = /https:\/\/raw\.githubusercontent\.com\/abran-labs\/ai-auth-kit\/([^/\s"'`]+)\/install\.sh/g;
const SHELL_BLOCK = /<!-- docs-smoke:([a-z0-9-]+) -->\s*```(?:bash|sh|shell)\n([\s\S]*?)```/g;
const ANY_SHELL_FENCE = /```(?:bash|sh|shell)\n/g;
const HELP_FLAG = /--[a-z][a-z-]*|-[A-Za-z]\b/g;
const CLI_COMMAND_LINE = /(?:^|\n)[ \t]*ai-auth-kit(?:[ \t]+[^\n]*)?/g;
const RETIRED_IDENTITY = String.fromCodePoint(118, 111, 120, 116, 121, 112, 101);
const README_INTERNAL_DETAIL = /--attestation-receipt|--test-attestation|manager-local-lifecycle|gh attestation verify|SHA256SUMS|release:build|INSTALLER_MANAGER_SIGNING_KEY/i;

function pushMatches(violations: string[], document: string, source: string, pattern: RegExp, reason: string): void {
	if (pattern.test(source)) violations.push(`${document}: ${reason}`);
}

export function shellBlocks(documents: ReadonlyMap<string, string>): readonly ShellBlock[] {
	const blocks: ShellBlock[] = [];
	for (const [document, source] of documents) {
		for (const match of source.matchAll(SHELL_BLOCK)) {
			const id = match[1];
			const command = match[2];
			if (id !== undefined && command !== undefined) blocks.push({ document, id, command });
		}
	}
	return blocks;
}

export function helpFlags(help: string): ReadonlySet<string> {
	return new Set(help.match(HELP_FLAG) ?? []);
}

export function documentationViolations(documents: ReadonlyMap<string, string>, policy: DocumentationPolicy): readonly string[] {
	const violations: string[] = [];
	const ids = new Set<string>();
	for (const [document, source] of documents) {
		if (source.toLowerCase().includes(RETIRED_IDENTITY)) {
			violations.push(`${document}: forbidden retired identity`);
		}
		if (document === "README.md" && README_INTERNAL_DETAIL.test(source)) {
			violations.push(`${document}: internal release or QA detail belongs outside the human README`);
		}
		const markedBlocks = [...source.matchAll(SHELL_BLOCK)];
		const shellFenceCount = [...source.matchAll(ANY_SHELL_FENCE)].length;
		if (markedBlocks.length !== shellFenceCount) violations.push(`${document}: every shell fence needs a docs-smoke id`);
		for (const match of markedBlocks) {
			const id = match[1];
			if (id === undefined) continue;
			if (ids.has(id)) violations.push(`${document}: duplicate docs-smoke id ${id}`);
			ids.add(id);
		}

		pushMatches(violations, document, source, /\bnpm\s+(?:i|install|add|publish)\b/i, "npm install/publish instruction is forbidden");
		pushMatches(violations, document, source, MISSING_GIT_REFERENCE, "Git dependency must include a full immutable SHA");
		pushMatches(violations, document, source, NONCANONICAL_GIT_REFERENCE, "noncanonical Git dependency syntax is forbidden");
		for (const match of source.matchAll(GIT_REFERENCE)) {
			const reference = match[1] ?? "";
			if (reference !== IMMUTABLE_PLACEHOLDER && !FULL_SHA.test(reference)) {
				violations.push(`${document}: Git dependency must use a full immutable SHA`);
			}
		}
		for (const match of source.matchAll(RAW_INSTALLER_REFERENCE)) {
			const reference = match[1] ?? "";
			if (reference !== IMMUTABLE_PLACEHOLDER && !FULL_SHA.test(reference)) violations.push(`${document}: raw installer URL must use a full immutable SHA`);
		}
		pushMatches(violations, document, source, /(?:workspace:|file:\.\.?\/|link:\.\.?\/|copy(?:ing|ied)?\s+(?:the\s+)?(?:package|source|workspace))/i, "local workspace/file/link/copy consumption is forbidden");
		pushMatches(violations, document, source, /(?:discover|search|resolve|look\s*up|execute)[^\n.]{0,60}\bPATH\b|command\s+-v\s+cli-proxy-api/i, "CLIProxyAPI PATH discovery is forbidden");
		pushMatches(violations, document, source, /(^|\s)--(?:google-)?login\b/m, "stale Google login flag is forbidden");
		for (const command of source.matchAll(CLI_COMMAND_LINE)) {
			for (const flag of (command[0].match(HELP_FLAG) ?? [])) {
				if (!policy.supportedCliFlags.has(flag)) violations.push(`${document}: unsupported AI Auth Kit CLI flag ${flag}`);
			}
		}
		pushMatches(violations, document, source, /\b\d+\s+(?:models?|providers?)\b/i, "catalog model/provider count is unstable");
		pushMatches(violations, document, source, /(?:installer|install\.sh)[^\n.]{0,80}\b(?:macOS|Darwin|Windows|FreeBSD)\b|\b(?:macOS|Darwin|Windows|FreeBSD)\b[^\n.]{0,80}(?:installer|install\.sh)/i, "installer platform claim is unsupported");
	}
	return violations;
}
