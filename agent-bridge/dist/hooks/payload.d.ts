import type { EndpointKind, HookEvent, NormalizedHookPayload } from "../core/types.ts";
export declare function normalizeHookPayload(producer: EndpointKind, event: HookEvent, raw: unknown): NormalizedHookPayload;
export declare function bridgeHash(payload: NormalizedHookPayload): string;
//# sourceMappingURL=payload.d.ts.map