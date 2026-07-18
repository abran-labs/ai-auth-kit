import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DOCUMENT_PATHS, documentationViolations, helpFlags } from "./docs-policy.js";

type NegativeCase = {
	readonly name: string;
	readonly injected: string;
	readonly expected: string;
};

const cliHelpProcess = Bun.spawn({ cmd: [process.execPath, "--bun", "src/cli.ts", "--help"], stdout: "pipe", stderr: "pipe" });
const [cliHelpExit, cliHelp, cliHelpError] = await Promise.all([
	cliHelpProcess.exited,
	new Response(cliHelpProcess.stdout).text(),
	new Response(cliHelpProcess.stderr).text(),
]);
if (cliHelpExit !== 0) throw new Error(`Could not read executable CLI help: ${cliHelpError}`);
const supportedCliFlags = helpFlags(cliHelp);
const unsupportedCliFlags = ["--login", "--google-login", "--verbose", "--token", "--config", "--global", "--claude-login", "--antigravity-login"]
	.filter((flag) => !supportedCliFlags.has(flag));
if (unsupportedCliFlags.length < 8) throw new Error("Unsupported CLI flag probes overlap executable help");

const cases: readonly NegativeCase[] = [
	{ name: "retired identity", injected: `\n${String.fromCodePoint(118, 111, 120, 116, 121, 112, 101)}\n`, expected: "forbidden retired identity" },
	{ name: "README release internals", injected: "\n`--attestation-receipt` is an internal manager input.\n", expected: "internal release or QA detail" },
	{ name: "npm command", injected: "\n```text\nnpm install @abran-labs/ai-auth-kit\n```\n", expected: "npm install/publish instruction" },
	{ name: "missing Git ref", injected: "\n`github:abran-labs/ai-auth-kit`\n", expected: "Git dependency must include" },
	{ name: "empty Git ref", injected: "\n`github:abran-labs/ai-auth-kit#`\n", expected: "Git dependency must include" },
	{ name: "mutable ref", injected: "\n`github:abran-labs/ai-auth-kit#main`\n", expected: "full immutable SHA" },
	{ name: "git+https mutable ref", injected: "\n`git+https://github.com/abran-labs/ai-auth-kit.git#main`\n", expected: "noncanonical Git dependency" },
	{ name: "git+https exact ref", injected: "\n`git+https://github.com/abran-labs/ai-auth-kit.git#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`\n", expected: "noncanonical Git dependency" },
	{ name: "SHA suffix", injected: "\n`github:abran-labs/ai-auth-kit#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaajunk`\n", expected: "full immutable SHA" },
	{ name: "malformed SHA placeholder", injected: "\n`github:abran-labs/ai-auth-kit#<40-hex>`\n", expected: "full immutable SHA" },
	{ name: "unresolved SHA variable", injected: "\n`github:abran-labs/ai-auth-kit#$AI_AUTH_KIT_SHA`\n", expected: "full immutable SHA" },
	{ name: "unresolved braced SHA variable", injected: "\n`github:abran-labs/ai-auth-kit#${AI_AUTH_KIT_SHA}`\n", expected: "full immutable SHA" },
	{ name: "arbitrary raw branch", injected: "\n`https://raw.githubusercontent.com/abran-labs/ai-auth-kit/feature/install.sh`\n", expected: "raw installer URL" },
	{ name: "stale catalog count", injected: "\nThe catalog contains 42 models.\n", expected: "catalog model/provider count" },
	{ name: "unsupported installer platform", injected: "\nThe installer supports Windows.\n", expected: "installer platform claim" },
	{ name: "unexecuted shell command", injected: "\n```sh\nprintf 'not registered\\n'\n```\n", expected: "every shell fence needs a docs-smoke id" },
	{ name: "workspace consumption", injected: "\nUse workspace:* for local consumption.\n", expected: "workspace/file/link/copy consumption" },
	{ name: "file consumption", injected: "\nUse file:../ai-auth-kit for local consumption.\n", expected: "workspace/file/link/copy consumption" },
	{ name: "link consumption", injected: "\nUse link:../ai-auth-kit for local consumption.\n", expected: "workspace/file/link/copy consumption" },
	{ name: "copied source consumption", injected: "\nConsume the package by copying the source.\n", expected: "workspace/file/link/copy consumption" },
	{ name: "PATH discovery", injected: "\nDiscover cli-proxy-api from PATH.\n", expected: "CLIProxyAPI PATH discovery" },
	...unsupportedCliFlags.map((flag) => ({ name: `unsupported CLI flag ${flag}`, injected: `\nai-auth-kit doctor ${flag}\n`, expected: "unsupported AI Auth Kit CLI flag" })),
] as const;

const root = process.cwd();
const canonical = new Map(await Promise.all(DOCUMENT_PATHS.map(async (path) => [path, await readFile(join(root, path), "utf8")] as const)));
const policy = { supportedCliFlags };
const baseline = documentationViolations(canonical, policy);
if (baseline.length > 0) throw new Error(`Canonical docs already violate policy:\n${baseline.join("\n")}`);

const readme = canonical.get("README.md");
if (readme === undefined) throw new Error("README.md is missing from canonical docs");

for (const negativeCase of cases) {
	const mutated = new Map(canonical);
	mutated.set("README.md", `${readme}${negativeCase.injected}`);
	const violations = documentationViolations(mutated, policy);
	if (!violations.some((violation) => violation.includes(negativeCase.expected))) {
		throw new Error(`${negativeCase.name} misleadingly passed docs policy: ${violations.join("; ")}`);
	}
	process.stdout.write(`${negativeCase.name} rejected\n`);
}

process.stdout.write(`docs negative QA passed ${cases.length} cases\n`);
