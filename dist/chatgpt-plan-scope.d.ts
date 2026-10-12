import { z } from "zod";
import { type ChatGptPlanTokens } from "./chatgpt-plan.js";
import { ChatGptPlanError } from "./chatgpt-plan-id-token.js";
export interface ChatGptTokenBody {
    readonly access_token: string;
    readonly refresh_token: string;
    readonly expires_in: number;
    readonly scope: string;
}
declare const PlanNotGrantedCauseSchema: z.ZodReadonly<z.ZodObject<{
    clientId: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    grantedScopes: z.ZodString;
    tokens: z.ZodOptional<z.ZodObject<{
        accessToken: z.ZodString;
        refreshToken: z.ZodString;
        expiresAt: z.ZodNumber;
        scopes: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        clientId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type ChatGptPlanNotGrantedCause = z.output<typeof PlanNotGrantedCauseSchema>;
export declare function planNotGrantedCause(error: unknown): ChatGptPlanNotGrantedCause | undefined;
export declare function splitPlanTokens(body: ChatGptTokenBody, clientId: string, now: number): {
    readonly tokens: ChatGptPlanTokens;
    readonly planGranted: boolean;
    readonly grantedScopes: string;
};
export declare function planNotGrantedError(clientId: string, grantedScopes: string, detail: Omit<ChatGptPlanNotGrantedCause, "clientId" | "grantedScopes">): ChatGptPlanError;
export {};
