import type { CliChoice } from "../core/types.ts";
export declare function chooseOne<T extends string>(title: string, choices: CliChoice<T>[]): Promise<T>;
export declare function chooseMany<T extends string>(title: string, choices: CliChoice<T>[]): Promise<T[]>;
//# sourceMappingURL=interactive.d.ts.map