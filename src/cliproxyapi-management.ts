import { z } from "zod";

export type CliProxyManagementFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type CliProxyManagementErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "upstream_unavailable"
  | "invalid_response";

export class CliProxyManagementError extends Error {
  readonly name = "CliProxyManagementError";
  constructor(readonly code: CliProxyManagementErrorCode, message: string, readonly status?: number, options?: ErrorOptions) {
    super(message, options);
  }
}

export interface CliProxyManagementOptions {
  readonly baseUrl: string;
  readonly managementKey: string;
  readonly fetch?: CliProxyManagementFetch;
  readonly timeoutMs?: number;
}

export interface CliProxyAuthUrl {
  readonly url: string;
  readonly state: string;
}

export type CliProxyOAuthStatus = "wait" | "ok" | "error";

export interface CliProxyOAuthStatusResult {
  readonly status: CliProxyOAuthStatus;
  readonly error?: string;
}

export interface CliProxyCredentialFile {
  readonly id: string;
  readonly authIndex: string;
  readonly name: string;
  readonly type: string;
  readonly provider: string;
  readonly label: string;
  readonly status: string;
  readonly statusMessage?: string;
  readonly disabled: boolean;
  readonly unavailable?: boolean;
  readonly email?: string;
}

export interface CliProxyCredentialModel {
  readonly id: string;
  readonly displayName?: string;
  readonly type?: string;
  readonly ownedBy?: string;
}

const MAX_RESPONSE_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 15_000;

const AuthUrlSchema = z
  .object({ status: z.literal("ok"), url: z.string().min(1).max(8192), state: z.string().min(1).max(256) })
  .readonly();

const CallbackSchema = z.object({ status: z.literal("ok") }).readonly();

const OAuthStatusSchema = z
  .object({ status: z.enum(["wait", "ok", "error"]), error: z.string().max(1024).optional() })
  .readonly();

const CancelSchema = z.object({ status: z.literal("ok"), cancelled: z.boolean().optional() }).readonly();

const CredentialFileSchema = z
  .object({
    id: z.string().min(1).max(1024),
    auth_index: z.string().max(1024),
    name: z.string().min(1).max(1024),
    type: z.string().max(256),
    provider: z.string().max(256),
    label: z.string().max(1024),
    status: z.string().max(256),
    status_message: z.string().max(2048).optional(),
    disabled: z.boolean(),
    unavailable: z.boolean().optional(),
    email: z.string().max(1024).optional(),
  })
  .readonly();

const CredentialsSchema = z
  .object({ observed_at: z.string().max(256), files: z.array(CredentialFileSchema).readonly() })
  .readonly();

const CredentialModelsSchema = z
  .object({
    models: z
      .array(
        z
          .object({
            id: z.string().min(1).max(1024),
            display_name: z.string().max(1024).optional(),
            type: z.string().max(256).optional(),
            owned_by: z.string().max(256).optional(),
          })
          .readonly(),
      )
      .readonly(),
  })
  .readonly();

function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new CliProxyManagementError("bad_request", "CLIProxyAPI management base URL is invalid");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new CliProxyManagementError("bad_request", "CLIProxyAPI management base URL is invalid");
  }
  return url.href.replace(/\/+$/, "");
}

export interface CliProxyManagementClient {
  readonly requestAuthUrl: (provider: string) => Promise<CliProxyAuthUrl>;
  readonly submitCallbackRedirect: (provider: string, redirectUrl: string) => Promise<void>;
  readonly oauthStatus: (state: string) => Promise<CliProxyOAuthStatusResult>;
  readonly cancelSession: (state: string) => Promise<boolean>;
  readonly listCredentials: () => Promise<readonly CliProxyCredentialFile[]>;
  readonly deleteCredential: (name: string) => Promise<void>;
  readonly patchCredentialPrefix: (name: string, prefix: string) => Promise<void>;
  readonly credentialModels: (name: string) => Promise<readonly CliProxyCredentialModel[]>;
}

export function createCliProxyManagementClient(options: CliProxyManagementOptions): CliProxyManagementClient {
  if (options.managementKey === "") {
    throw new CliProxyManagementError("unauthorized", "CLIProxyAPI management key is required");
  }
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new CliProxyManagementError("bad_request", "CLIProxyAPI management timeout is invalid");
  }

  function failure(code: CliProxyManagementErrorCode, message: string, status?: number): CliProxyManagementError {
    return new CliProxyManagementError(code, message, status);
  }

  async function readJson(path: string, response: Response): Promise<unknown> {
    const declared = response.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
      throw failure("invalid_response", `CLIProxyAPI management response exceeds size limit: ${path}`);
    }
    if (response.body === null) throw failure("invalid_response", `CLIProxyAPI management response is empty: ${path}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const current = await reader.read();
        if (current.done) break;
        total += current.value.byteLength;
        if (total > MAX_RESPONSE_BYTES) throw failure("invalid_response", `CLIProxyAPI management response exceeds size limit: ${path}`);
        chunks.push(current.value);
      }
    } catch (error) {
      if (error instanceof CliProxyManagementError) throw error;
      throw failure("upstream_unavailable", `CLIProxyAPI management response failed: ${path}`);
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw failure("invalid_response", `CLIProxyAPI management response is not JSON: ${path}`);
    }
  }

  async function request(path: string, init: { readonly method: string; readonly body?: string }): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers: { Accept: "application/json", Authorization: `Bearer ${options.managementKey}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: init.body,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw failure("upstream_unavailable", `CLIProxyAPI management request failed: ${init.method} ${path}`);
    }
    return response;
  }

  function throwForStatus(method: string, path: string, response: Response): never {
    const status = response.status;
    if (status === 400) throw failure("bad_request", `CLIProxyAPI management rejected the request: ${method} ${path}`, status);
    if (status === 401 || status === 403) throw failure("unauthorized", "CLIProxyAPI management key was rejected", status);
    if (status === 404) throw failure("not_found", `CLIProxyAPI management resource is missing: ${method} ${path}`, status);
    if (status === 409) throw failure("conflict", `CLIProxyAPI management flow already completed: ${method} ${path}`, status);
    throw failure("upstream_unavailable", `CLIProxyAPI management request failed: ${method} ${path} (${status})`, status);
  }

  function parse<T>(schema: z.ZodType<T>, path: string, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw failure("invalid_response", `CLIProxyAPI management response failed validation: ${path}`);
    return parsed.data;
  }

  async function call<T>(method: string, path: string, schema: z.ZodType<T>, body?: string): Promise<T> {
    const response = await request(path, { method, body });
    if (!response.ok) throwForStatus(method, path, response);
    return parse(schema, path, await readJson(path, response));
  }

  const get = <T>(path: string, schema: z.ZodType<T>): Promise<T> => call("GET", path, schema);

  return {
    async requestAuthUrl(provider: string): Promise<CliProxyAuthUrl> {
      const result = await get(`/v8/management/oauth/auth-url?provider=${encodeURIComponent(provider)}`, AuthUrlSchema);
      return { url: result.url, state: result.state };
    },
    async submitCallbackRedirect(provider: string, redirectUrl: string): Promise<void> {
      const path = "/v8/management/oauth/callback";
      const response = await request(path, { method: "POST", body: JSON.stringify({ provider, redirect_url: redirectUrl }) });
      if (!response.ok) throwForStatus("POST", path, response);
      parse(CallbackSchema, path, await readJson(path, response));
    },
    async oauthStatus(state: string): Promise<CliProxyOAuthStatusResult> {
      const result = await get(`/v8/management/oauth/status?state=${encodeURIComponent(state)}`, OAuthStatusSchema);
      return result.status === "error" ? { status: result.status, error: result.error } : { status: result.status };
    },
    async cancelSession(state: string): Promise<boolean> {
      const result = await call("DELETE", `/v8/management/oauth/session?state=${encodeURIComponent(state)}`, CancelSchema);
      return result.cancelled ?? true;
    },
    async listCredentials(): Promise<readonly CliProxyCredentialFile[]> {
      const result = await get("/v8/management/credentials", CredentialsSchema);
      return result.files.map((file) => ({
        id: file.id, authIndex: file.auth_index, name: file.name, type: file.type,
        provider: file.provider, label: file.label, status: file.status, disabled: file.disabled,
        ...(file.status_message === undefined ? {} : { statusMessage: file.status_message }),
        ...(file.unavailable === undefined ? {} : { unavailable: file.unavailable }),
        ...(file.email === undefined ? {} : { email: file.email }),
      }));
    },
    async deleteCredential(name: string): Promise<void> {
      const path = `/v8/management/credentials?name=${encodeURIComponent(name)}`;
      const response = await request(path, { method: "DELETE" });
      if (!response.ok) throwForStatus("DELETE", path, response);
      await response.body?.cancel();
    },
    async patchCredentialPrefix(name: string, prefix: string): Promise<void> {
      const path = "/v8/management/credentials/fields";
      const response = await request(path, { method: "PATCH", body: JSON.stringify({ name, prefix }) });
      if (!response.ok) throwForStatus("PATCH", path, response);
      await response.body?.cancel();
    },
    async credentialModels(name: string): Promise<readonly CliProxyCredentialModel[]> {
      const result = await get(`/v8/management/credentials/models?name=${encodeURIComponent(name)}`, CredentialModelsSchema);
      return result.models.map((model) => ({
        id: model.id,
        ...(model.display_name === undefined ? {} : { displayName: model.display_name }),
        ...(model.type === undefined ? {} : { type: model.type }),
        ...(model.owned_by === undefined ? {} : { ownedBy: model.owned_by }),
      }));
    },
  };
}
