import type { EndpointKind, HookEvent, BridgeResponse, BridgeResult } from "../core/types.ts";
export interface ProducerResponse {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export declare function mapBridgeToProducerResponse(producer: EndpointKind, event: HookEvent, response: BridgeResponse): ProducerResponse;
export declare function formatBridgeReport(result: BridgeResult): string;
//# sourceMappingURL=producer-response.d.ts.map