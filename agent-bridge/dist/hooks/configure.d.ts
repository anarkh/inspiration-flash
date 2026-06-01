import type { ConfigScope, EndpointKind, HookEvent } from "../core/types.ts";
export interface ConfigureHooksOptions {
    producers: EndpointKind[];
    scope: ConfigScope;
    events: HookEvent[];
    cwd: string;
}
export interface ClearHooksOptions {
    producers: EndpointKind[];
    scope: ConfigScope;
    cwd: string;
}
export declare function configureHooks(options: ConfigureHooksOptions): Promise<string[]>;
export declare function clearHooks(options: ClearHooksOptions): Promise<string[]>;
export declare function configureCodexHooks(scope: ConfigScope, events: HookEvent[], cwd: string): Promise<string[]>;
export declare function clearCodexHooks(scope: ConfigScope, cwd: string): Promise<string[]>;
export declare function configureClaudeHooks(scope: ConfigScope, events: HookEvent[], cwd: string): Promise<string[]>;
export declare function clearClaudeHooks(scope: ConfigScope, cwd: string): Promise<string[]>;
export declare function configureAidenHooks(scope: ConfigScope, events: HookEvent[], cwd: string): Promise<string[]>;
export declare function clearAidenHooks(scope: ConfigScope, cwd: string): Promise<string[]>;
export declare function buildHookCommand(producer: EndpointKind, event: HookEvent): string;
export declare function ensureTomlFeatureHooks(content: string): string;
export declare function packageRoot(): string;
//# sourceMappingURL=configure.d.ts.map