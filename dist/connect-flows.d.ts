import { type ConnectFlowContext, type SubmitInput } from "./connect-flow-state.js";
import type { ConnectMethod, ConnectResponse } from "./connect-protocol.js";
export declare function startFlow(context: ConnectFlowContext, tenantId: string, providerId: string, method: ConnectMethod, fresh: boolean): Promise<ConnectResponse>;
export declare function submitFlow(context: ConnectFlowContext, tenantId: string, flowId: string, input: SubmitInput): Promise<ConnectResponse>;
export declare function pollFlow(context: ConnectFlowContext, tenantId: string, flowId: string): Promise<ConnectResponse>;
export declare function cancelFlow(context: ConnectFlowContext, tenantId: string, flowId: string): Promise<ConnectResponse>;
