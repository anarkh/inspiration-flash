import type { Agent, AppConfig, BridgeRoute, EndpointKind } from "../core/types.ts";
export declare function defaultConfig(): AppConfig;
export declare function loadConfig(): Promise<AppConfig>;
export declare function saveConfig(config: AppConfig): Promise<void>;
export declare function upsertAgent(kind: EndpointKind, command: string): Promise<Agent>;
export declare function upsertRoute(producer: EndpointKind, consumers: EndpointKind[]): Promise<BridgeRoute>;
export declare function removeRoute(producer: EndpointKind): Promise<boolean>;
export declare function removeAllBridgeConfig(): Promise<boolean>;
//# sourceMappingURL=store.d.ts.map