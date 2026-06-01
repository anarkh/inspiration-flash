export declare function pathExists(path: string): Promise<boolean>;
export declare function ensureDir(path: string): Promise<void>;
export declare function readText(path: string): Promise<string | null>;
export declare function writeText(path: string, content: string): Promise<void>;
export declare function readJson<T>(path: string, fallback: T): Promise<T>;
export declare function writeJson(path: string, value: unknown): Promise<void>;
export declare function truncateText(text: string, maxChars: number): string;
//# sourceMappingURL=fs.d.ts.map