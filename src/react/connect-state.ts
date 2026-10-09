import type {
	ConnectMethod,
	ConnectModel,
	ConnectProvider,
	ConnectResponse,
	ConnectStatus,
	ConnectStep,
	Connection,
} from "../connect-protocol.js";

export type ConnectPhase =
	| "loading"
	| "idle"
	| "method"
	| "step"
	| "models";

export interface ConnectState {
	readonly error?: string;
	readonly filter: string;
	readonly modelFilter: string;
	readonly models: readonly ConnectModel[];
	readonly modelsProviderId?: string;
	readonly phase: ConnectPhase;
	readonly provider?: ConnectProvider;
	readonly providers: readonly ConnectProvider[];
	readonly retryable: boolean;
	readonly showAll: boolean;
	readonly status?: ConnectStatus;
	readonly step?: ConnectStep;
	readonly working: boolean;
}

export type ConnectAction =
	| { readonly kind: "load-started" }
	| {
			readonly kind: "load-succeeded";
			readonly providers: readonly ConnectProvider[];
			readonly status: ConnectStatus;
	  }
	| { readonly kind: "load-failed"; readonly message: string; readonly retryable: boolean }
	| { readonly kind: "show-all" }
	| { readonly kind: "show-featured" }
	| { readonly kind: "set-filter"; readonly filter: string }
	| { readonly kind: "set-model-filter"; readonly filter: string }
	| { readonly kind: "select-provider"; readonly provider: ConnectProvider }
	| { readonly kind: "back-to-providers" }
	| { readonly kind: "step-started" }
	| { readonly kind: "step-arrived"; readonly step: ConnectStep }
	| { readonly kind: "step-failed"; readonly message: string; readonly retryable: boolean }
	| { readonly kind: "flow-cancelled" }
	| {
			readonly kind: "models-arrived";
			readonly models: readonly ConnectModel[];
			readonly providerId: string;
	  }
	| { readonly kind: "models-failed"; readonly message: string; readonly retryable: boolean }
	| { readonly kind: "open-models"; readonly providerId: string }
	| { readonly kind: "model-selected" }
	| { readonly kind: "disconnected" }
	| { readonly kind: "clear-error" };

export const initialConnectState: ConnectState = {
	filter: "",
	modelFilter: "",
	models: [],
	phase: "loading",
	providers: [],
	retryable: false,
	showAll: false,
	working: true,
};

function fail(state: ConnectState, message: string, retryable: boolean): ConnectState {
	return { ...state, error: message, retryable, working: false };
}

export function connectReducer(state: ConnectState, action: ConnectAction): ConnectState {
	switch (action.kind) {
		case "load-started":
			return { ...initialConnectState };
		case "load-succeeded":
			return {
				...state,
				error: undefined,
				phase: "idle",
				providers: action.providers,
				retryable: false,
				status: action.status,
				step: undefined,
				working: false,
			};
		case "load-failed":
			return { ...fail(state, action.message, action.retryable), phase: "idle" };
		case "show-all":
			return { ...state, showAll: true };
		case "show-featured":
			return { ...state, filter: "", showAll: false };
		case "set-filter":
			return { ...state, filter: action.filter };
		case "set-model-filter":
			return { ...state, modelFilter: action.filter };
		case "select-provider":
			return {
				...state,
				error: undefined,
				modelFilter: "",
				models: [],
				modelsProviderId: undefined,
				phase: "method",
				provider: action.provider,
				retryable: false,
			};
		case "back-to-providers":
			return {
				...state,
				error: undefined,
				models: [],
				modelsProviderId: undefined,
				phase: "idle",
				provider: undefined,
				retryable: false,
				step: undefined,
				working: false,
			};
		case "step-started":
			return { ...state, error: undefined, retryable: false, working: true };
		case "step-arrived":
			return {
				...state,
				error: undefined,
				phase: "step",
				retryable: false,
				step: action.step,
				working: action.step.kind === "working",
			};
		case "step-failed":
			return { ...fail(state, action.message, action.retryable) };
		case "flow-cancelled":
			return {
				...state,
				error: undefined,
				phase: "idle",
				provider: undefined,
				retryable: false,
				step: undefined,
				working: false,
			};
		case "models-arrived":
			return {
				...state,
				error: undefined,
				modelFilter: "",
				models: action.models,
				modelsProviderId: action.providerId,
				phase: "models",
				retryable: false,
				working: false,
			};
		case "models-failed":
			return { ...fail(state, action.message, action.retryable) };
		case "open-models":
			return {
				...state,
				error: undefined,
				modelFilter: "",
				models: [],
				modelsProviderId: action.providerId,
				phase: "models",
				retryable: false,
				working: true,
			};
		case "model-selected":
			return {
				...state,
				error: undefined,
				models: [],
				modelsProviderId: undefined,
				phase: "idle",
				provider: undefined,
				retryable: false,
				step: undefined,
				working: false,
			};
		case "disconnected":
			return {
				...state,
				error: undefined,
				models: [],
				modelsProviderId: undefined,
				phase: "idle",
				provider: undefined,
				retryable: false,
				step: undefined,
				working: false,
			};
		case "clear-error":
			return { ...state, error: undefined, retryable: false };
	}
}

export type ConnectSubmitInput =
	| { readonly kind: "secret"; readonly value: string }
	| { readonly kind: "redirect-url"; readonly value: string }
	| { readonly kind: "confirm"; readonly accepted: boolean };

export function responseError(response: ConnectResponse): { readonly message: string; readonly retryable: boolean } | undefined {
	if (response.kind === "error") return { message: response.message, retryable: response.retryable };
	return undefined;
}

export function visibleProviders(
	providers: readonly ConnectProvider[],
	showAll: boolean,
	featuredOnlyInitially: boolean,
	filter: string,
): readonly ConnectProvider[] {
	const query = filter.trim().toLowerCase();
	const scoped =
		showAll || !featuredOnlyInitially
			? providers
			: providers.filter((provider) => provider.featured);
	if (query === "") return scoped;
	return scoped.filter(
		(provider) =>
			provider.name.toLowerCase().includes(query) || provider.id.toLowerCase().includes(query),
	);
}

export function hasChatgptPlanMethod(provider: ConnectProvider): boolean {
	return provider.methods.some(
		(option: ConnectProvider["methods"][number]) =>
			option.method === ("account" satisfies ConnectMethod) && option.flow === "chatgpt-plan",
	);
}

export function hasApiKeyMethod(provider: ConnectProvider): boolean {
	return provider.methods.some(
		(option: ConnectProvider["methods"][number]) => option.method === ("api-key" satisfies ConnectMethod),
	);
}

export function responseFailure(response: ConnectResponse): {
	readonly message: string;
	readonly retryable: boolean;
} {
	const failure = responseError(response);
	if (failure !== undefined) return failure;
	return { message: "connect service returned an unexpected response", retryable: false };
}

export function readStepConnection(response: ConnectResponse): Connection | undefined {
	if (response.kind === "step" && response.step.kind === "connected") return response.step.connection;
	return undefined;
}
