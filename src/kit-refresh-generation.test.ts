import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { CHATGPT_PLAN_SCOPE } from "./chatgpt-plan.js";
import { createAuthKit, type AuthKit } from "./kit.js";
import { createMemoryTenantStore } from "./hosted-store.js";
import type { ExternalOAuthCredential, ProviderDefinition } from "./types.js";

const vi = { fn: mock, spyOn };
const SCOPES = `openid profile email offline_access resource.invoke ${CHATGPT_PLAN_SCOPE}`;
const PROVIDERS: readonly ProviderDefinition[] = [
  { id: "openai", name: "OpenAI", envVars: ["OPENAI_API_KEY"], authMethods: ["api-key", "oauth-external", "env"], models: [] },
];

function expiredMetadata(): Record<string, string> {
  return {
    adapter: "openai-chatgpt-plan",
    clientId: "oaiapp_session",
    subject: "user-sub",
    accessTokenRef: "provider:openai:oauth:access-token",
    refreshTokenRef: "provider:openai:oauth:refresh-token",
    expiresAt: String(Date.now() - 60_000),
    scopes: SCOPES,
    baseUrl: "https://api.openai.com/v1",
  };
}

async function seedExpired(kit: AuthKit, refreshToken: string): Promise<ExternalOAuthCredential> {
  return kit.saveExternalOAuth("openai", expiredMetadata(), [
    ["provider:openai:oauth:access-token", "stale-access"],
    ["provider:openai:oauth:refresh-token", refreshToken],
  ]);
}

function delayedRefresh(accessToken: string): void {
  const impl = Object.assign(
    async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      void input;
      void init;
      await new Promise((resolve) => { setTimeout(resolve, 30); });
      return Response.json({ access_token: accessToken, refresh_token: "rt-rotated", expires_in: 3600, scope: SCOPES });
    },
    { preconnect: globalThis.fetch.preconnect },
  );
  const fetch = Object.assign(vi.fn<typeof globalThis.fetch>().mockImplementation(impl), { preconnect: globalThis.fetch.preconnect });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
}

afterEach(() => {
  mock.restore();
});

test("Given an in-flight refresh, when disconnect removes the credential, then the refresh does not resurrect it", async () => {
  const tenants = createMemoryTenantStore();
  const kit = createAuthKit({ storage: tenants.storage("tenant-a"), providers: PROVIDERS });
  await seedExpired(kit, "rt-original");
  delayedRefresh("at-resurrected");

  const refreshing = kit.runtimeAuth("openai");
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  await kit.removeCredential("openai");
  await refreshing;

  expect(await kit.getCredential("openai")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBeUndefined();
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBeUndefined();
});

test("Given an in-flight refresh, when a new sign-in replaces the credential, then the stale refresh is discarded", async () => {
  const tenants = createMemoryTenantStore();
  const kit = createAuthKit({ storage: tenants.storage("tenant-a"), providers: PROVIDERS });
  await seedExpired(kit, "rt-original");
  delayedRefresh("at-stale");

  const refreshing = kit.runtimeAuth("openai");
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  const replacement = await kit.saveExternalOAuth("openai", expiredMetadata(), [
    ["provider:openai:oauth:access-token", "at-replacement"],
    ["provider:openai:oauth:refresh-token", "rt-replacement"],
  ]);
  await refreshing;

  const live = await kit.getCredential("openai");
  if (live?.type !== "oauth-external") throw new Error("Expected the replacement credential");
  expect(live.createdAt).toBe(replacement.createdAt);
  expect(await kit.secrets.get("provider:openai:oauth:access-token")).toBe("at-replacement");
  expect(await kit.secrets.get("provider:openai:oauth:refresh-token")).toBe("rt-replacement");
});
