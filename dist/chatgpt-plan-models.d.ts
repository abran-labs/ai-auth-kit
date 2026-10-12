import type { AuthFetch, ModelDefinition } from "./types.js";
export declare const CHATGPT_PLAN_MODELS_URL = "https://api.openai.com/v1/models";
export interface ChatGptPlanModelsInput {
    readonly accessToken: string;
    readonly fetch?: AuthFetch;
}
export declare function listChatGptPlanModels(input: ChatGptPlanModelsInput): Promise<readonly ModelDefinition[]>;
