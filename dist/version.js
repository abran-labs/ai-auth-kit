import { readFileSync } from "node:fs";
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
function parsePackageVersion(value) {
    if (typeof value !== "object" || value === null || !("version" in value) || typeof value.version !== "string" || !SEMVER.test(value.version)) {
        throw new Error("package.json contains a malformed version");
    }
    return value.version;
}
export const CLI_VERSION = typeof AI_AUTH_KIT_VERSION === "string"
    ? AI_AUTH_KIT_VERSION
    : parsePackageVersion(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")));
//# sourceMappingURL=version.js.map