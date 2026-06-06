export type AuthMethod = "api-key" | "env" | "oauth-external" | "none";

export interface ModelDefinition {
  readonly id: string;
  readonly name: string;
  readonly contextWindow?: number;
  readonly tags?: readonly string[];
}

export interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly envVars: readonly string[];
  readonly authMethods: readonly AuthMethod[];
  readonly models: readonly ModelDefinition[];
  readonly docsUrl?: string;
  readonly notes?: string;
}

export interface ApiKeyCredential {
  readonly type: "api-key";
  readonly secretRef: string;
  readonly createdAt: string;
}

export interface EnvCredential {
  readonly type: "env";
  readonly envVar: string;
  readonly createdAt: string;
}

export interface ExternalOAuthCredential {
  readonly type: "oauth-external";
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: string;
}

export interface NoAuthCredential {
  readonly type: "none";
  readonly createdAt: string;
}

export type StoredCredential = ApiKeyCredential | EnvCredential | ExternalOAuthCredential | NoAuthCredential;

export interface SelectedModel {
  readonly providerId: string;
  readonly modelId: string;
  readonly updatedAt: string;
}

export interface AuthKitState {
  readonly credentials: Readonly<Record<string, StoredCredential>>;
  readonly selectedModel?: SelectedModel;
  readonly updatedAt: string;
}

export interface AuthKitStore {
  readonly path?: string;
  read(): Promise<AuthKitState>;
  write(state: AuthKitState): Promise<void>;
}

export interface SecretStore {
  readonly path?: string;
  get(ref: string): Promise<string | undefined>;
  set(ref: string, value: string): Promise<void>;
  delete(ref: string): Promise<void>;
}

export interface RuntimeAuth {
  readonly providerId: string;
  readonly credential: StoredCredential | undefined;
  readonly env: Readonly<Record<string, string>>;
}

export interface ResolvedSelection {
  readonly provider: ProviderDefinition;
  readonly model: ModelDefinition;
  readonly credential: StoredCredential | undefined;
}

export interface AuthKitOptions {
  readonly configDir?: string;
  readonly providers?: readonly ProviderDefinition[];
  readonly store?: AuthKitStore;
  readonly secrets?: SecretStore;
}
