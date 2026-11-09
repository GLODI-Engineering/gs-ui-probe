/**
 * What the probe did, in order.
 *
 * An end-to-end failure says "expected 2 wires, got 1". The useful question
 * is which of the fourteen actions before it did not do what it looked
 * like it did, and a trace is the cheapest way to answer it — far cheaper
 * than re-running with a video and watching.
 */

export type Action =
  | { kind: "move"; to: string; px: number }
  | { kind: "click"; to: string; button?: string }
  | { kind: "doubleClick"; to: string }
  | { kind: "drag"; from: string; to: string }
  | { kind: "wheel"; to: string; px: number }
  | { kind: "press"; key: string }
  | { kind: "type"; text: string }
  | { kind: "note"; text: string };

export interface RecordedAction {
  action: Action;
  at: number;
  durationMs: number;
  failed?: string;
}

export function describeAction(action: Action): string {
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
  readonly actions: RecordedAction[] = [];
  private readonly onAction: ((action: Action) => void) | undefined;
  private readonly started = Date.now();

  constructor(onAction?: (action: Action) => void) {
    this.onAction = onAction;
  }

  /** Run `body`, recording it — and recording that it failed, if it does. */
  async record<T>(action: Action, body: () => Promise<T>): Promise<T> {
    const at = Date.now() - this.started;
    const begun = Date.now();
    this.onAction?.(action);
    try {
      const result = await body();
      this.actions.push({ action, at, durationMs: Date.now() - begun });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.actions.push({ action, at, durationMs: Date.now() - begun, failed: message });
      // Re-thrown with the history attached, because the action that threw
      // is rarely the one that was wrong.
      throw new Error(`${describeAction(action)} failed: ${message}\n\n${this.format()}`);
    }
  }

  /** A free-text marker, for structuring a long scenario. */
  note(text: string): void {
    this.actions.push({ action: { kind: "note", text }, at: Date.now() - this.started, durationMs: 0 });
    this.onAction?.({ kind: "note", text });
  }

  format(): string {
    if (this.actions.length === 0) return "(no actions recorded)";
    const lines = this.actions.map((entry) => {
      const time = `${String(entry.at).padStart(6)}ms`;
      const marker = entry.failed ? " <-- FAILED" : "";
      const prefix = entry.action.kind === "note" ? "--" : "  ";
      return `${time} ${prefix} ${describeAction(entry.action)}${marker}`;
    });
    return `what the probe did:\n${lines.join("\n")}`;
  }

  clear(): void {
    this.actions.length = 0;
  }
}
