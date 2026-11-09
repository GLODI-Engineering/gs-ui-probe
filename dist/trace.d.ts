/**
 * What the probe did, in order.
 *
 * An end-to-end failure says "expected 2 wires, got 1". The useful question
 * is which of the fourteen actions before it did not do what it looked
 * like it did, and a trace is the cheapest way to answer it — far cheaper
 * than re-running with a video and watching.
 */
export type Action = {
    kind: "move";
    to: string;
    px: number;
} | {
    kind: "click";
    to: string;
    button?: string;
} | {
    kind: "doubleClick";
    to: string;
} | {
    kind: "drag";
    from: string;
    to: string;
} | {
    kind: "wheel";
    to: string;
    px: number;
} | {
    kind: "press";
    key: string;
} | {
    kind: "type";
    text: string;
} | {
    kind: "note";
    text: string;
};
export interface RecordedAction {
    action: Action;
    at: number;
    durationMs: number;
    failed?: string;
}
export declare function describeAction(action: Action): string;
export declare class Trace {
    readonly actions: RecordedAction[];
    private readonly onAction;
    private readonly started;
    constructor(onAction?: (action: Action) => void);
    /** Run `body`, recording it — and recording that it failed, if it does. */
    record<T>(action: Action, body: () => Promise<T>): Promise<T>;
    /** A free-text marker, for structuring a long scenario. */
    note(text: string): void;
    format(): string;
    clear(): void;
}
//# sourceMappingURL=trace.d.ts.map