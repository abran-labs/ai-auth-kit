import { z } from "zod";
import { ChatGptPlanError } from "./chatgpt-plan.js";
import type { AuthFetch, ModelDefinition } from "./types.js";

export const CHATGPT_PLAN_MODELS_URL = "https://api.openai.com/v1/models";
const MODELS_TIMEOUT_MS = 15_000;

const PlanModelsResponseSchema = z.object({
  models: z.array(z.looseObject({
    slug: z.string().min(1),
    display_name: z.string().min(1),
    visibility: z.string().optional(),
  })).readonly(),
});

const DataModelsResponseSchema = z.object({
  data: z.array(z.looseObject({ id: z.string().min(1) })).readonly(),
});

export interface ChatGptPlanModelsInput {
  readonly accessToken: string;
  readonly fetch?: AuthFetch;
}

export async function listChatGptPlanModels(input: ChatGptPlanModelsInput): Promise<readonly ModelDefinition[]> {
  const fetchImpl = input.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchImpl(CHATGPT_PLAN_MODELS_URL, {
      redirect: "error",
      headers: { accept: "application/json", authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ChatGptPlanError("upstream_unavailable", "Could not load ChatGPT plan models.", { cause: error });
  }
  if (!response.ok) throw new ChatGptPlanError("upstream_unavailable", `ChatGPT plan models are unavailable (${response.status}).`);
  const body: unknown = await response.json().catch(() => undefined);
  const plan = PlanModelsResponseSchema.safeParse(body);
  if (plan.success) {
    return plan.data.models
      .filter((model) => model.visibility === "list")
      .map((model): ModelDefinition => ({ id: model.slug, name: model.display_name }));
  }
  const data = DataModelsResponseSchema.safeParse(body);
  if (data.success) return data.data.data.map((model): ModelDefinition => ({ id: model.id, name: model.id }));
  throw new ChatGptPlanError("upstream_unavailable", "ChatGPT returned an unexpected model list.");
}
