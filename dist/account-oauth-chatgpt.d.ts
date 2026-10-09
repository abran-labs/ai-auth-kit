import type * as prompts from "@clack/prompts";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ProviderDefinition, StoredCredential } from "./types.js";
export interface ChatGptPlanLoginPrompts {
    readonly info: (message: string) => void;
    readonly text?: typeof prompts.text;
}
export interface ChatGptPlanLoginDeps {
    readonly fetch?: AuthFetch;
    readonly now?: () => number;
    readonly openUrl?: (url: string) => Promise<boolean>;
    readonly agentName?: string;
    readonly chatGptLoopbackPorts?: readonly number[];
    readonly chatGptLoopbackTimeoutMs?: number;
}
export interface ChatGptPlanSignOutResult {
    readonly remoteRevocationConfirmed: boolean;
}
export declare function loginChatGptPlan(kit: AuthKit, provider: ProviderDefinition, prompts: ChatGptPlanLoginPrompts, deps?: ChatGptPlanLoginDeps): Promise<StoredCredential | undefined>;
export declare function signOutChatGptPlan(kit: AuthKit, deps?: {
    readonly fetch?: AuthFetch;
}): Promise<ChatGptPlanSignOutResult>;
