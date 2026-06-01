export interface SpawnInputOptions {
    cwd: string;
    timeout: number;
    env: NodeJS.ProcessEnv;
    capture?: SpawnCapture;
}
export interface SpawnInputResult {
    stdout: string;
    stderr: string;
}
export interface AgentCommandRunner {
    run(command: string, args: string[], input: string, options: SpawnInputOptions): Promise<SpawnInputResult>;
}
export interface SpawnProcessInfo {
    pid: number;
    command: string;
    args: string[];
    cwd: string;
}
export interface SpawnCapture {
    onStart?(info: SpawnProcessInfo): void;
    onStdout?(chunk: Buffer): void;
    onStderr?(chunk: Buffer): void;
    onClose?(code: number | null): void;
}
export declare function spawnWithInput(command: string, args: string[], input: string, options: SpawnInputOptions): Promise<SpawnInputResult>;
//# sourceMappingURL=process.d.ts.map