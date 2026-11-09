/**
 * `Probe` — do to a page what a person would.
 *
 * Every method takes a `Target` (see geometry.ts), moves the pointer there
 * the way a hand would (see motion.ts), and records what it did (see
 * trace.ts) so a failure three actions later can say how it got there.
 *
 * It knows nothing about any application. Anything application-shaped —
 * "place a component", "wire these two ports" — belongs in a layer above
 * this one, written in terms of these primitives.
 */

import {
  type Point,
  type Target,
  describeTarget,
  distance,
  resolveTarget,
} from "./geometry.js";
import { DEFAULT_MAX_STEPS, DEFAULT_STEP_PX, jitter, makeRandom, pathBetween } from "./motion.js";
import { type Action, Trace } from "./trace.js";

export type MouseButton = "left" | "right" | "middle";
export type Modifier = "Alt" | "Control" | "Meta" | "Shift";

/** The slice of Playwright's `Page` this library actually uses. */
export interface PageLike {
  mouse: {
    move(x: number, y: number, options?: { steps?: number }): Promise<void>;
    down(options?: { button?: MouseButton; clickCount?: number }): Promise<void>;
    up(options?: { button?: MouseButton; clickCount?: number }): Promise<void>;
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
  keyboard: {
    press(key: string, options?: { delay?: number }): Promise<void>;
    down(key: string): Promise<void>;
    up(key: string): Promise<void>;
    type(text: string, options?: { delay?: number }): Promise<void>;
    insertText(text: string): Promise<void>;
  };
  waitForTimeout(ms: number): Promise<void>;
}

export interface ProbeOptions {
  /** Roughly how far the pointer travels between move events. Default 24. */
  stepPx?: number;
  /** Hard cap on move events per leg. Default 120. */
  maxSteps?: number;
  /**
   * Pause after each action, letting the app react. Default 60 ms.
   *
   * It is a settle, not a sleep-and-hope: assertions still have to wait for
   * what they are asserting. This exists because a burst of actions with no
   * gap at all is the one thing a person never does, and it hides ordering
   * bugs that appear the moment a real user is slower than the event loop.
   */
  settleMs?: number;
  /**
   * How far off a target the pointer may land, in pixels. Default 0.
   *
   * Raise it to find hit targets that are smaller than they look. Keep it
   * below the real tolerance of what you are aiming at, or you are testing
   * the jitter rather than the UI.
   */
  jitterPx?: number;
  /** Sideways wander on a drag path. Default 0. */
  curvePx?: number;
  /** Makes jitter and curvature reproducible. Default 1. */
  seed?: number;
  /** Delay between keystrokes when typing. Default 20 ms. */
  typeDelayMs?: number;
  /** Called with each action as it is recorded. */
  onAction?: (action: Action) => void;
}

export interface DragOptions {
  button?: MouseButton;
  modifiers?: Modifier[];
  /** Points the drag must pass through, in order. */
  via?: Target[];
  /**
   * Pause after pressing, before moving. Default 40 ms.
   *
   * Some UI only begins a drag after the pointer has been held still for a
   * moment, or needs a frame to set up a preview. Pressing and moving in
   * the same tick skips that and the drag silently does nothing.
   */
  holdMs?: number;
  /** Pause before releasing, so a drop target can register the hover. */
  dropDelayMs?: number;
}

export interface ClickOptions {
  button?: MouseButton;
  modifiers?: Modifier[];
  clickCount?: number;
}

export class Probe {
  readonly trace: Trace;
  private readonly page: PageLike;
  private readonly options: Required<Omit<ProbeOptions, "onAction">>;
  private readonly random: () => number;
  private cursor: Point = { x: 0, y: 0 };

  constructor(page: PageLike, options: ProbeOptions = {}) {
    this.page = page;
    this.options = {
      stepPx: options.stepPx ?? DEFAULT_STEP_PX,
      maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
      settleMs: options.settleMs ?? 60,
      jitterPx: options.jitterPx ?? 0,
      curvePx: options.curvePx ?? 0,
      seed: options.seed ?? 1,
      typeDelayMs: options.typeDelayMs ?? 20,
    };
    this.random = makeRandom(this.options.seed);
    this.trace = new Trace(options.onAction);
  }

  /** A probe like this one, with some options changed. */
  with(options: ProbeOptions): Probe {
    return new Probe(this.page, { ...this.options, ...options });
  }

  /** Where the pointer is, as far as this probe knows. */
  get position(): Point {
    return { ...this.cursor };
  }

  /** Resolve a target without moving. */
  async pointOf(target: Target): Promise<Point> {
    return await resolveTarget(target);
  }

  async moveTo(target: Target): Promise<Point> {
    const aim = jitter(await resolveTarget(target), this.options.jitterPx, this.random);
    return await this.trace.record(
      { kind: "move", to: describeTarget(target), px: Math.round(distance(this.cursor, aim)) },
      async () => {
        await this.travel(aim);
        return aim;
      },
    );
  }

  async click(target: Target, options: ClickOptions = {}): Promise<void> {
    const button = options.button;
    await this.trace.record(
      { kind: "click", to: describeTarget(target), ...(button ? { button } : {}) },
      async () => {
      const aim = jitter(await resolveTarget(target), this.options.jitterPx, this.random);
      await this.travel(aim);
      await this.withModifiers(options.modifiers ?? [], async () => {
        await this.page.mouse.down({
          button: options.button ?? "left",
          clickCount: options.clickCount ?? 1,
        });
        await this.page.mouse.up({
          button: options.button ?? "left",
          clickCount: options.clickCount ?? 1,
        });
      });
        await this.settle();
      },
    );
  }

  async doubleClick(target: Target, options: ClickOptions = {}): Promise<void> {
    await this.trace.record({ kind: "doubleClick", to: describeTarget(target) }, async () => {
      const aim = jitter(await resolveTarget(target), this.options.jitterPx, this.random);
      await this.travel(aim);
      await this.withModifiers(options.modifiers ?? [], async () => {
        // Two presses with the right clickCount, not two clicks: a UI that
        // listens for `dblclick` never hears it otherwise.
        await this.page.mouse.down({ clickCount: 1 });
        await this.page.mouse.up({ clickCount: 1 });
        await this.page.mouse.down({ clickCount: 2 });
        await this.page.mouse.up({ clickCount: 2 });
      });
      await this.settle();
    });
  }

  async rightClick(target: Target): Promise<void> {
    await this.click(target, { button: "right" });
  }

  /**
   * Press at `from`, travel to `to`, release.
   *
   * The journey is the point. A drag implemented as press-jump-release
   * exercises none of the dragging.
   */
  async drag(from: Target, to: Target, options: DragOptions = {}): Promise<void> {
    await this.trace.record(
      { kind: "drag", from: describeTarget(from), to: describeTarget(to) },
      async () => {
        const start = jitter(await resolveTarget(from), this.options.jitterPx, this.random);
        await this.travel(start);

        await this.withModifiers(options.modifiers ?? [], async () => {
          await this.page.mouse.down({ button: options.button ?? "left" });
          await this.page.waitForTimeout(options.holdMs ?? 40);

          const via: Point[] = [];
          for (const waypoint of options.via ?? []) via.push(await resolveTarget(waypoint));
          const end = jitter(await resolveTarget(to), this.options.jitterPx, this.random);

          await this.travel(end, via);
          await this.page.waitForTimeout(options.dropDelayMs ?? 40);
          await this.page.mouse.up({ button: options.button ?? "left" });
        });
        await this.settle();
      },
    );
  }

  /** Drag from a target by a pixel offset. */
  async dragBy(from: Target, dx: number, dy: number, options: DragOptions = {}): Promise<void> {
    const origin = await resolveTarget(from);
    await this.drag(from, { x: origin.x + dx, y: origin.y + dy }, options);
  }

  /** Rubber-band from one corner to another. */
  async marquee(from: Target, to: Target, options: DragOptions = {}): Promise<void> {
    await this.drag(from, to, options);
  }

  async wheel(target: Target, deltaY: number, deltaX = 0): Promise<void> {
    await this.trace.record({ kind: "wheel", to: describeTarget(target), px: deltaY }, async () => {
      await this.travel(await resolveTarget(target));
      await this.page.mouse.wheel(deltaX, deltaY);
      await this.settle();
    });
  }

  /** `press("Control+Z")`, or a sequence: `press(["Escape", "Enter"])`. */
  async press(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      await this.trace.record({ kind: "press", key }, async () => {
        await this.page.keyboard.press(key);
        await this.settle();
      });
    }
  }

  async type(text: string, options: { delayMs?: number } = {}): Promise<void> {
    await this.trace.record({ kind: "type", text }, async () => {
      await this.page.keyboard.type(text, {
        delay: options.delayMs ?? this.options.typeDelayMs,
      });
      await this.settle();
    });
  }

  /** Hold modifiers for the duration of `body`, releasing them even if it throws. */
  async withModifiers<T>(modifiers: Modifier[], body: () => Promise<T>): Promise<T> {
    for (const modifier of modifiers) await this.page.keyboard.down(modifier);
    try {
      return await body();
    } finally {
      for (const modifier of [...modifiers].reverse()) await this.page.keyboard.up(modifier);
    }
  }

  /** Pause, the way a person pauses between actions. */
  async settle(ms?: number): Promise<void> {
    await this.page.waitForTimeout(ms ?? this.options.settleMs);
  }

  private async travel(to: Point, via: Point[] = []): Promise<void> {
    const path = pathBetween(this.cursor, to, {
      stepPx: this.options.stepPx,
      maxSteps: this.options.maxSteps,
      curvePx: this.options.curvePx,
      random: this.random,
      via,
    });
    for (const point of path) {
      await this.page.mouse.move(point.x, point.y);
    }
    this.cursor = to;
  }
}
