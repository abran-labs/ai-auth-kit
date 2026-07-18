import { z } from "zod";

const sevenDaysInMilliseconds = 604800000;
const registryMetadataSchema = z
	.object({ time: z.record(z.string(), z.string()) })
	.strict();

export interface LockAgeAuditInput {
	readonly currentLock: string;
	readonly baselineLock: string;
	readonly metadataByPackage: ReadonlyMap<string, string>;
	readonly now: number;
}

function parseJsonc(source: string): unknown {
	return JSON.parse(source.replace(/,(\s*[}\]])/g, "$1"));
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return Object.fromEntries(Object.entries(value));
	}
	throw new Error(`${label} must be an object`);
}

export function parseBunLock(source: string): ReadonlyMap<string, string> {
	const lock = record(parseJsonc(source), "Bun lock");
	const packages = record(lock["packages"], "Bun lock packages");
	const resolutions = new Map<string, string>();

	for (const [name, tuple] of Object.entries(packages)) {
		if (!Array.isArray(tuple) || typeof tuple[0] !== "string") {
			throw new Error(`invalid lock tuple for ${name}`);
		}
		const separator = tuple[0].lastIndexOf("@");
		if (separator <= 0 || separator === tuple[0].length - 1) {
			throw new Error(`invalid lock resolution for ${name}`);
		}
		resolutions.set(name, tuple[0].slice(separator + 1));
	}
	return resolutions;
}

export function parseRegistryMetadata(source: string): ReadonlyMap<string, number> {
	const parsed = registryMetadataSchema.safeParse(parseJsonc(source));
	if (!parsed.success) throw new Error("invalid registry metadata");
	const publishTimes = new Map<string, number>();
	for (const [version, publishedAt] of Object.entries(parsed.data.time)) {
		const timestamp = Date.parse(publishedAt);
		if (Number.isNaN(timestamp)) throw new Error(`invalid publish time for ${version}`);
		publishTimes.set(version, timestamp);
	}
	return publishTimes;
}

export function auditChangedLockAges(input: LockAgeAuditInput): readonly string[] {
	const current = parseBunLock(input.currentLock);
	const baseline = parseBunLock(input.baselineLock);
	const violations: string[] = [];

	for (const [name, version] of current) {
		if (baseline.get(name) === version) continue;
		const metadata = input.metadataByPackage.get(name);
		if (metadata === undefined) {
			violations.push(`${name}@${version}: registry metadata unavailable`);
			continue;
		}
		const publishedAt = parseRegistryMetadata(metadata).get(version);
		if (publishedAt === undefined) {
			violations.push(`${name}@${version}: publish time unavailable`);
			continue;
		}
		if (input.now - publishedAt < sevenDaysInMilliseconds) {
			violations.push(`${name}@${version}: minimum release age not met`);
		}
	}
	return violations;
}

export function assertNoStalePeerMetadata(lockSource: string, peerDependencies: Readonly<Record<string, string>>): void {
	const lock = record(parseJsonc(lockSource), "Bun lock");
	const workspaces = record(lock["workspaces"], "Bun lock workspaces");
	const workspace = record(workspaces[""], "Bun lock workspace");
	const lockedPeers = record(workspace["peerDependencies"] ?? {}, "Bun lock peer dependencies");
	for (const name of Object.keys(lockedPeers)) {
		if (peerDependencies[name] === undefined) throw new Error(`stale peer metadata: ${name}`);
	}
}

export function requireAgeRejection(exitCode: number, output: string): void {
	if (exitCode === 0 || !/minimum[- ]release[- ]age/i.test(output)) {
		throw new Error(`expected minimum release age rejection; exit=${exitCode}; output=${output}`);
	}
}

export async function fetchRegistryMetadata(
	registry: string,
	packageName: string,
	timeoutMilliseconds: number,
): Promise<ReadonlyMap<string, number>> {
	const url = `${registry.replace(/\/$/, "")}/${encodeURIComponent(packageName)}`;
	const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMilliseconds) });
	if (!response.ok) throw new Error(`registry metadata request failed: ${response.status}`);
	return parseRegistryMetadata(await response.text());
}
