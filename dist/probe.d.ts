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
import { type Point, type Target } from "./geometry.js";
import { type Action, Trace } from "./trace.js";
export type MouseButton = "left" | "right" | "middle";
export type Modifier = "Alt" | "Control" | "Meta" | "Shift";
/** The slice of Playwright's `Page` this library actually uses. */
export interface PageLike {
    mouse: {
        move(x: number, y: number, options?: {
            steps?: number;
        }): Promise<void>;
        down(options?: {
            button?: MouseButton;
            clickCount?: number;
        }): Promise<void>;
        up(options?: {
            button?: MouseButton;
            clickCount?: number;
        }): Promise<void>;
        wheel(deltaX: number, deltaY: number): Promise<void>;
    };
    keyboard: {
        press(key: string, options?: {
            delay?: number;
        }): Promise<void>;
        down(key: string): Promise<void>;
        up(key: string): Promise<void>;
        type(text: string, options?: {
            delay?: number;
        }): Promise<void>;
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
export declare class Probe {
    readonly trace: Trace;
    private readonly page;
    private readonly options;
    private readonly random;
    private cursor;
    constructor(page: PageLike, options?: ProbeOptions);
    /** A probe like this one, with some options changed. */
    with(options: ProbeOptions): Probe;
    /** Where the pointer is, as far as this probe knows. */
    get position(): Point;
    /** Resolve a target without moving. */
    pointOf(target: Target): Promise<Point>;
    moveTo(target: Target): Promise<Point>;
    click(target: Target, options?: ClickOptions): Promise<void>;
    doubleClick(target: Target, options?: ClickOptions): Promise<void>;
    rightClick(target: Target): Promise<void>;
    /**
     * Press at `from`, travel to `to`, release.
     *
     * The journey is the point. A drag implemented as press-jump-release
     * exercises none of the dragging.
     */
    drag(from: Target, to: Target, options?: DragOptions): Promise<void>;
    /** Drag from a target by a pixel offset. */
    dragBy(from: Target, dx: number, dy: number, options?: DragOptions): Promise<void>;
    /** Rubber-band from one corner to another. */
    marquee(from: Target, to: Target, options?: DragOptions): Promise<void>;
    wheel(target: Target, deltaY: number, deltaX?: number): Promise<void>;
    /** `press("Control+Z")`, or a sequence: `press(["Escape", "Enter"])`. */
    press(keys: string | string[]): Promise<void>;
    type(text: string, options?: {
        delayMs?: number;
    }): Promise<void>;
    /** Hold modifiers for the duration of `body`, releasing them even if it throws. */
    withModifiers<T>(modifiers: Modifier[], body: () => Promise<T>): Promise<T>;
    /** Pause, the way a person pauses between actions. */
    settle(ms?: number): Promise<void>;
    private travel;
}
//# sourceMappingURL=probe.d.ts.map