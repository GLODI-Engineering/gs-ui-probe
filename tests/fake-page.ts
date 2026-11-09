import type { PageLike } from "../src/probe.js";

export type Event =
  | { type: "move"; x: number; y: number }
  | { type: "down"; button: string; clickCount: number }
  | { type: "up"; button: string; clickCount: number }
  | { type: "wheel"; dx: number; dy: number }
  | { type: "keydown"; key: string }
  | { type: "keyup"; key: string }
  | { type: "keypress"; key: string }
  | { type: "text"; text: string }
  | { type: "wait"; ms: number };

/**
 * A page that records rather than renders.
 *
 * The probe's contract is the event stream it produces, so the honest way
 * to test it is to capture that stream — and it doubles as proof that the
 * library depends on a handful of methods rather than on Playwright.
 */
export class FakePage implements PageLike {
  readonly events: Event[] = [];

  readonly mouse = {
    move: async (x: number, y: number) => {
      this.events.push({ type: "move", x, y });
    },
    down: async (options?: { button?: string; clickCount?: number }) => {
      this.events.push({
        type: "down",
        button: options?.button ?? "left",
        clickCount: options?.clickCount ?? 1,
      });
    },
    up: async (options?: { button?: string; clickCount?: number }) => {
      this.events.push({
        type: "up",
        button: options?.button ?? "left",
        clickCount: options?.clickCount ?? 1,
      });
    },
    wheel: async (dx: number, dy: number) => {
      this.events.push({ type: "wheel", dx, dy });
    },
  };

  readonly keyboard = {
    press: async (key: string) => {
      this.events.push({ type: "keypress", key });
    },
    down: async (key: string) => {
      this.events.push({ type: "keydown", key });
    },
    up: async (key: string) => {
      this.events.push({ type: "keyup", key });
    },
    type: async (text: string) => {
      this.events.push({ type: "text", text });
    },
    insertText: async (text: string) => {
      this.events.push({ type: "text", text });
    },
  };

  async waitForTimeout(ms: number): Promise<void> {
    this.events.push({ type: "wait", ms });
  }

  /** Just the coordinates, so assertions read as coordinates. */
  moves(): Array<{ x: number; y: number }> {
    return this.events
      .filter((e): e is Extract<Event, { type: "move" }> => e.type === "move")
      .map(({ x, y }) => ({ x, y }));
  }

  kinds(): string[] {
    return this.events.filter((e) => e.type !== "wait").map((e) => e.type);
  }
}

/** A stand-in for a Playwright Locator with a fixed box. */
export function fakeElement(box: { x: number; y: number; width: number; height: number }) {
  return { boundingBox: async () => box };
}

export function missingElement() {
  return { boundingBox: async () => null };
}
