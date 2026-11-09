/**
 * What the probe did, in order.
 *
 * An end-to-end failure says "expected 2 wires, got 1". The useful question
 * is which of the fourteen actions before it did not do what it looked
 * like it did, and a trace is the cheapest way to answer it — far cheaper
 * than re-running with a video and watching.
 */
export function describeAction(action) {
    switch (action.kind) {
        case "move":
            return `move to ${action.to} (${action.px}px)`;
        case "click":
            return `${action.button && action.button !== "left" ? `${action.button}-` : ""}click ${action.to}`;
        case "doubleClick":
            return `double-click ${action.to}`;
        case "drag":
            return `drag ${action.from} -> ${action.to}`;
        case "wheel":
            return `wheel ${action.px > 0 ? "down" : "up"} over ${action.to}`;
        case "press":
            return `press ${action.key}`;
        case "type":
            return `type ${JSON.stringify(action.text)}`;
        default:
            return action.text;
    }
}
export class Trace {
    actions = [];
    onAction;
    started = Date.now();
    constructor(onAction) {
        this.onAction = onAction;
    }
    /** Run `body`, recording it — and recording that it failed, if it does. */
    async record(action, body) {
        const at = Date.now() - this.started;
        const begun = Date.now();
        this.onAction?.(action);
        try {
            const result = await body();
            this.actions.push({ action, at, durationMs: Date.now() - begun });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.actions.push({ action, at, durationMs: Date.now() - begun, failed: message });
            // Re-thrown with the history attached, because the action that threw
            // is rarely the one that was wrong.
            throw new Error(`${describeAction(action)} failed: ${message}\n\n${this.format()}`);
        }
    }
    /** A free-text marker, for structuring a long scenario. */
    note(text) {
        this.actions.push({ action: { kind: "note", text }, at: Date.now() - this.started, durationMs: 0 });
        this.onAction?.({ kind: "note", text });
    }
    format() {
        if (this.actions.length === 0)
            return "(no actions recorded)";
        const lines = this.actions.map((entry) => {
            const time = `${String(entry.at).padStart(6)}ms`;
            const marker = entry.failed ? " <-- FAILED" : "";
            const prefix = entry.action.kind === "note" ? "--" : "  ";
            return `${time} ${prefix} ${describeAction(entry.action)}${marker}`;
        });
        return `what the probe did:\n${lines.join("\n")}`;
    }
    clear() {
        this.actions.length = 0;
    }
}
//# sourceMappingURL=trace.js.map