import type { SafeDirectory } from "./safe-dir.js";
export declare function readFileAnchored(directory: SafeDirectory, name: string): Promise<string | undefined>;
export declare function writeFileAtomic(directory: SafeDirectory, name: string, value: unknown): Promise<void>;
export declare function unlinkFileAnchored(directory: SafeDirectory, name: string): Promise<void>;
