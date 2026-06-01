import type { RawHookEnvelope, BridgeResponse } from "../core/types.ts";
export declare function runServiceForeground(): Promise<void>;
export declare function startService(): Promise<void>;
export declare function stopService(): Promise<void>;
export declare function printServiceStatus(): Promise<void>;
export declare function printDashboardUrl(): Promise<void>;
export declare function submitBridge(envelope: RawHookEnvelope): Promise<BridgeResponse | null>;
//# sourceMappingURL=server.d.ts.map