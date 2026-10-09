import { z } from "zod";
import { type ChatGptSignIn } from "./chatgpt-plan.js";
export declare const CHATGPT_PLAN_ADAPTER = "openai-chatgpt-plan";
export declare const CLIPROXYAPI_ACCOUNT_ADAPTER = "cliproxyapi-account";
export interface ChatGptPlanSecretRefs {
    readonly accessTokenRef: string;
    readonly refreshTokenRef: string;
    readonly idTokenRef: string;
}
export declare const ChatGptPlanMetadataSchema: z.ZodReadonly<z.ZodObject<{
    adapter: z.ZodLiteral<"openai-chatgpt-plan">;
    clientId: z.ZodString;
    subject: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    accessTokenRef: z.ZodOptional<z.ZodString>;
    refreshTokenRef: z.ZodOptional<z.ZodString>;
    idTokenRef: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
    scopes: z.ZodString;
    baseUrl: z.ZodLiteral<"https://api.openai.com/v1">;
    health: z.ZodOptional<z.ZodLiteral<"reconnect-required">>;
}, z.core.$strip>>;
export type ChatGptPlanMetadata = z.output<typeof ChatGptPlanMetadataSchema>;
export declare function chatGptPlanSecretRefs(providerId: string): ChatGptPlanSecretRefs;
export declare function chatGptPlanMetadata(signIn: ChatGptSignIn, refs: ChatGptPlanSecretRefs): Readonly<Record<string, string>>;
export declare function parseChatGptPlanMetadata(metadata: Readonly<Record<string, string>>): ChatGptPlanMetadata | undefined;
