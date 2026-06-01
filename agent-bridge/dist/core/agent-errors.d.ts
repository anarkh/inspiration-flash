export type KnownAgentErrorKind = "rate_limit" | "auth";
export interface KnownAgentError {
    kind: KnownAgentErrorKind;
    pattern: RegExp;
    title(agent: string): string;
    summary(agent: string): string;
    suggestedPrompt: string;
}
export declare function detectKnownAgentError(text: string): KnownAgentError | null;
export declare function firstKnownAgentErrorLine(text: string, error: KnownAgentError): string | null;
//# sourceMappingURL=agent-errors.d.ts.map