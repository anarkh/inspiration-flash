import type { Agent, AppConfig, EndpointKind, RawHookEnvelope, BridgeResponse } from "../core/types.ts";
export declare function runBridge(envelope: RawHookEnvelope): Promise<BridgeResponse>;
export declare function selectRouteAgents(config: AppConfig, producer: EndpointKind): Agent[];
//# sourceMappingURL=runner.d.ts.map