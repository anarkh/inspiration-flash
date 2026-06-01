import { detectKnownAgentError, firstKnownAgentErrorLine } from "../core/agent-errors.js";
export function parseBridgeOutput(output, agent) {
    const text = extractTextFromCliOutput(output).trim();
    const parsed = tryParseJsonObject(text);
    if (parsed) {
        return normalizeParsedResult(parsed, agent, text);
    }
    const knownError = knownErrorResult(text, agent);
    if (knownError) {
        return knownError;
    }
    return {
        verdict: "uncertain",
        summary: "Agent did not return parseable JSON.",
        findings: [{
                severity: "info",
                title: "Unstructured agent output",
                detail: text.slice(0, 4000)
            }],
        suggestedPrompt: "Inspect the unstructured agent output and decide whether another producer pass is needed.",
        agent,
        rawOutput: text
    };
}
function knownErrorResult(text, agent) {
    const knownError = detectKnownAgentError(text);
    if (!knownError) {
        return null;
    }
    return {
        verdict: "uncertain",
        summary: knownError.summary(agent),
        findings: [{
                severity: "info",
                title: knownError.title(agent),
                detail: firstKnownAgentErrorLine(text, knownError) ?? text.slice(0, 1000)
            }],
        suggestedPrompt: knownError.suggestedPrompt,
        agent,
        rawOutput: text
    };
}
export function extractTextFromCliOutput(output) {
    const trimmed = stripAnsi(output).trim();
    if (!trimmed) {
        return "";
    }
    const parsed = tryJson(trimmed);
    if (parsed !== null) {
        return extractText(parsed);
    }
    return trimmed;
}
function stripAnsi(text) {
    return text
        .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
        .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\r/g, "");
}
function normalizeParsedResult(value, agent, rawOutput) {
    const verdict = normalizeVerdict(value.verdict);
    const summary = typeof value.summary === "string" && value.summary.trim()
        ? value.summary.trim()
        : "Agent returned no summary.";
    const suggestedPrompt = typeof value.suggestedPrompt === "string"
        ? value.suggestedPrompt
        : typeof value.suggested_prompt === "string"
            ? value.suggested_prompt
            : "";
    const findings = normalizeFindings(value.findings);
    return {
        verdict,
        summary,
        findings,
        suggestedPrompt,
        agent,
        rawOutput
    };
}
function normalizeVerdict(value) {
    return value === "pass" || value === "fail" || value === "uncertain" ? value : "uncertain";
}
function normalizeFindings(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => {
        if (typeof item === "string") {
            return { title: item };
        }
        if (typeof item === "object" && item !== null) {
            const record = item;
            return {
                severity: normalizeSeverity(record.severity),
                title: typeof record.title === "string" ? record.title : "Finding",
                detail: typeof record.detail === "string" ? record.detail : undefined,
                file: typeof record.file === "string" ? record.file : undefined,
                line: typeof record.line === "number" ? record.line : undefined
            };
        }
        return { title: String(item) };
    });
}
function normalizeSeverity(value) {
    if (value === "critical" || value === "high" || value === "medium" || value === "low" || value === "info") {
        return value;
    }
    return undefined;
}
function tryParseJsonObject(text) {
    const candidates = [
        text,
        fencedJson(text),
        ...jsonObjectCandidates(text).reverse()
    ].filter((item) => Boolean(item));
    for (const candidate of candidates) {
        const parsed = tryJson(candidate);
        if (isBridgeResultObject(parsed)) {
            return parsed;
        }
    }
    return null;
}
function tryJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function fencedJson(text) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return match?.[1]?.trim() ?? null;
}
function isBridgeResultObject(value) {
    return typeof value === "object"
        && value !== null
        && !Array.isArray(value)
        && ("verdict" in value || "summary" in value || "findings" in value || "suggestedPrompt" in value);
}
function jsonObjectCandidates(text) {
    const candidates = [];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] !== "{") {
            continue;
        }
        const candidate = balancedJsonObjectFrom(text, index);
        if (candidate) {
            candidates.push(candidate);
        }
    }
    return candidates;
}
function balancedJsonObjectFrom(text, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (char === "\\") {
                escaped = true;
            }
            else if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
            continue;
        }
        if (char === "{") {
            depth += 1;
            continue;
        }
        if (char === "}" && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
    }
    return null;
}
function extractText(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(extractText).filter(Boolean).join("\n");
    }
    if (typeof value === "object" && value !== null) {
        const record = value;
        if (typeof record.result === "string") {
            return record.result;
        }
        if (typeof record.text === "string") {
            return record.text;
        }
        if (typeof record.content === "string") {
            return record.content;
        }
        if (Array.isArray(record.content)) {
            return record.content.map(extractText).filter(Boolean).join("\n");
        }
        if (record.message) {
            return extractText(record.message);
        }
    }
    return JSON.stringify(value);
}
//# sourceMappingURL=result-parser.js.map