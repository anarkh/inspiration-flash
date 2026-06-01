import type http from "node:http";
import type { Duplex } from "node:stream";
export declare function handleTerminalWebSocket(request: http.IncomingMessage, socket: Duplex, head: Buffer, runId: string, kind: string): Promise<void>;
//# sourceMappingURL=websocket.d.ts.map