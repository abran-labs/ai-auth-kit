import { revokeChatGptSession, ChatGptPlanError } from "./chatgpt-plan.js";
import { CHATGPT_PLAN_ADAPTER, CLIPROXYAPI_ACCOUNT_ADAPTER } from "./chatgpt-plan-credential.js";
import { ConnectError, type HostedMethodOffer } from "./connect-flow-state.js";
import {
  chatGptPlanModelsForTenant,
  filterChatGptPlanModels,
  hostedApiKeyBaseUrl,
  pickDefaultModel,
  proxyBindingFrom,
  providerConnection,
  summarizeStatus,
} from "./connect-runtime.js";
import type { ConnectModel, ConnectNotice, ConnectProvider, ConnectResponse, Connection } from "./connect-protocol.js";
import { ProxyAccountError, type ProxyAccountConnector } from "./hosted-types.js";
import type { AuthKit } from "./kit.js";
import type { AuthFetch, ModelDefinition, ProviderDefinition } from "./types.js";

export interface ConnectOpsContext {
  readonly findProvider: (providerId: string) => ProviderDefinition | undefined;
  readonly isProviderAllowed: (providerId: string) => boolean;
  readonly kitFor: (tenantId: string) => AuthKit;
  readonly currentProviders: () => readonly ProviderDefinition[];
  readonly featuredIds: readonly string[];
  readonly chatGptEnabled: boolean;
  readonly proxyAccounts: ProxyAccountConnector | undefined;
  readonly fetch: AuthFetch | undefined;
}

function toConnectModel(model: ModelDefinition): ConnectModel {
  return {
    id: model.id,
    name: model.name,
    ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
    ...(model.tags === undefined ? {} : { tags: model.tags }),
  };
}

export function hostedMethods(context: ConnectOpsContext, provider: ProviderDefinition): readonly HostedMethodOffer[] {
  if (provider.id === "github-copilot") return [];
  const offers: HostedMethodOffer[] = [];
  if (provider.authMethods.includes("api-key") && hostedApiKeyBaseUrl(provider.id) !== undefined) {
    offers.push({ method: "api-key", flow: "secret" });
  }
  if (provider.id === "openai" && context.chatGptEnabled) offers.push({ method: "account", flow: "chatgpt-plan" });
  if (context.proxyAccounts?.providerIds.includes(provider.id) === true) {
    offers.push({ method: "account", flow: "proxy-account" });
  }
  return offers;
}

export function providersResponse(context: ConnectOpsContext): ConnectResponse {
  const featuredOrder = new Map(context.featuredIds.map((id, index) => [id, index]));
  const providers = context
    .currentProviders()
    .filter((provider) => context.isProviderAllowed(provider.id))
    .flatMap((provider): readonly ConnectProvider[] => {
      const methods = hostedMethods(context, provider).map((offer) => {
        switch (offer.flow) {
          case "secret":
            return { method: offer.method, flow: offer.flow, label: "API key", hint: `Paste a ${provider.name} API key` };
          case "chatgpt-plan":
            return { method: offer.method, flow: offer.flow, label: "ChatGPT plan", hint: "Use a ChatGPT Plus or Pro subscription" };
          case "proxy-account": {
            const warning = context.proxyAccounts?.warning(provider.id) ?? "";
            return { method: offer.method, flow: offer.flow, label: `Sign in with ${provider.name}`, ...(warning.trim().length === 0 ? {} : { risk: warning }) };
          }
        }
      });
      if (methods.length === 0) return [];
      return [{ id: provider.id, name: provider.name, featured: featuredOrder.has(provider.id), methods, ...(provider.docsUrl === undefined ? {} : { docsUrl: provider.docsUrl }) }];
    })
    .sort((left, right) => (featuredOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (featuredOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name));
  return { kind: "providers", providers };
}

export async function modelsFor(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<readonly ConnectModel[]> {
  const provider = context.findProvider(providerId);
  if (provider === undefined) throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
  const credential = await context.kitFor(tenantId).getCredential(provider.id);
  if (credential?.type === "oauth-external" && credential.metadata.adapter === CLIPROXYAPI_ACCOUNT_ADAPTER) {
    const binding = proxyBindingFrom(credential.metadata);
    if (binding === undefined || context.proxyAccounts === undefined) {
      throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
    }
    try {
      return (await context.proxyAccounts.models(binding)).map(toConnectModel);
    } catch (error) {
      if (error instanceof ProxyAccountError) throw error;
      throw new ConnectError("internal", "Something went wrong. Try again.", true, { cause: error });
    }
  }
  const catalogModels = credential?.type === "oauth-external" && credential.metadata.adapter === CHATGPT_PLAN_ADAPTER && provider.id === "openai"
    ? await chatGptPlanModels(provider, tenantId, context)
    : provider.models;
  return catalogModels.map(toConnectModel);
}

async function chatGptPlanModels(provider: ProviderDefinition, tenantId: string, context: ConnectOpsContext): Promise<readonly ModelDefinition[]> {
  try {
    const live = await chatGptPlanModelsForTenant({ kit: context.kitFor(tenantId), providerId: provider.id, fetch: context.fetch });
    if (live !== undefined && live.length > 0) {
      return live.map((model): ModelDefinition => ({ id: model.id, name: model.name }));
    }
  } catch (error) {
    if (!(error instanceof ChatGptPlanError)) throw error;
  }
  return filterChatGptPlanModels(provider.models);
}

export async function readConnection(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<Connection | undefined> {
  const provider = context.findProvider(providerId);
  if (provider === undefined) return undefined;
  const credential = await context.kitFor(tenantId).getCredential(provider.id);
  if (credential === undefined) return undefined;
  return providerConnection(provider, credential);
}

export async function ensureDefaultModel(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<void> {
  const kit = context.kitFor(tenantId);
  if ((await kit.getSelectedModel()) !== undefined) return;
  const provider = context.findProvider(providerId);
  if (provider === undefined) return;
  const fallback = pickDefaultModel(await modelsFor(context, tenantId, providerId));
  if (fallback === undefined) return;
  await writeSelection(kit, provider, fallback);
}

export async function statusFor(context: ConnectOpsContext, tenantId: string): Promise<ConnectResponse> {
  return { kind: "status", status: summarizeStatus(context.currentProviders(), await context.kitFor(tenantId).readState()) };
}

async function writeSelection(kit: AuthKit, provider: ProviderDefinition, model: ConnectModel): Promise<void> {
  const catalogModel = provider.models.find((entry) => entry.id === model.id);
  const snapshotModel: ModelDefinition = catalogModel ?? {
    id: model.id,
    name: model.name,
    ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
    ...(model.tags === undefined ? {} : { tags: [...model.tags] }),
  };
  const state = await kit.store.read();
  const updatedAt = new Date().toISOString();
  await kit.store.write({ ...state, selectedModel: { providerId: provider.id, modelId: snapshotModel.id, updatedAt, snapshot: { provider, model: snapshotModel } }, updatedAt });
}

export async function selectModelOp(context: ConnectOpsContext, tenantId: string, providerId: string, modelId: string): Promise<ConnectResponse> {
  const provider = context.findProvider(providerId);
  if (provider === undefined) throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
  if ((await context.kitFor(tenantId).getCredential(provider.id)) === undefined) {
    throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
  }
  const match = (await modelsFor(context, tenantId, provider.id)).find((model) => model.id === modelId);
  if (match === undefined) throw new ConnectError("unknown_model", `Unknown model for ${provider.name}: ${modelId}`, false);
  await writeSelection(context.kitFor(tenantId), provider, match);
  return statusFor(context, tenantId);
}

export async function disconnectOp(context: ConnectOpsContext, tenantId: string, providerId: string): Promise<ConnectResponse> {
  const provider = context.findProvider(providerId);
  if (provider === undefined) throw new ConnectError("unknown_provider", `Unknown provider: ${providerId}`, false);
  const kit = context.kitFor(tenantId);
  const credential = await kit.getCredential(provider.id);
  if (credential === undefined) throw new ConnectError("not_connected", `No ${provider.name} connection. Connect first.`, false);
  let notice: ConnectNotice | undefined;
  if (credential.type === "oauth-external" && credential.metadata.adapter === CHATGPT_PLAN_ADAPTER) {
    const clientId = credential.metadata.clientId;
    const refreshRef = credential.metadata.refreshTokenRef;
    const refreshToken = refreshRef === undefined ? undefined : await kit.secrets.get(refreshRef);
    let confirmed = clientId === undefined || refreshToken === undefined;
    if (clientId !== undefined && refreshToken !== undefined) {
      confirmed = await revokeChatGptSession({ clientId, refreshToken, ...(context.fetch === undefined ? {} : { fetch: context.fetch }) }).catch(() => false);
    }
    if (!confirmed) notice = "remote-revocation-unconfirmed";
  }
  if (credential.type === "oauth-external" && credential.metadata.adapter === CLIPROXYAPI_ACCOUNT_ADAPTER) {
    const binding = proxyBindingFrom(credential.metadata);
    if (binding !== undefined) {
      try {
        await context.proxyAccounts?.disconnect({ tenantId, providerId: provider.id }, binding);
      } catch (error) {
        throw new ConnectError("upstream_unavailable", "The sign-in service is unavailable. Try again.", true, { cause: error });
      }
    }
  }
  await kit.removeCredential(provider.id);
  const state = await kit.store.read();
  if (state.selectedModel?.providerId === provider.id) {
    await kit.store.write({ ...state, selectedModel: undefined, updatedAt: new Date().toISOString() });
  }
  const status = summarizeStatus(context.currentProviders(), await kit.readState());
  return notice === undefined ? { kind: "status", status } : { kind: "status", status, notice };
}
