/**
 * How the pointer gets from one place to another.
 *
 * ## Why not just jump
 *
 * Playwright's `mouse.move(x, y)` dispatches a single `mousemove`. Plenty of
 * UI never notices: a drag that only reads `mousedown` and `mouseup` works
 * fine. But anything that tracks motion — a canvas drawing a live preview, a
 * drop zone that highlights on hover, a gesture that needs a threshold
 * crossed before it starts — sees one event where a person produces fifty,
 * and behaves differently under test than in front of a user. Those are
 * exactly the bugs an end-to-end test is for.
 *
 * So movement is interpolated, with easing, at a step size the caller
 * controls. The default is fine enough for preview-tracking UI and coarse
 * enough not to make a suite crawl.
 */
import type { Point } from "./geometry.js";
/** Deterministic, seeded, and good enough for jitter. Mulberry32. */
export declare function makeRandom(seed: number): () => number;
/**
 * Ease-in-out. A real hand accelerates away from rest and slows into the
 * target; linear interpolation does neither, and UI that measures pointer
 * velocity (inertial panning, flick gestures) can tell.
 */
export declare function easeInOutCubic(t: number): number;
export interface PathOptions {
    /** Roughly how far the pointer travels between events. */
    stepPx?: number;
    /** Hard cap on steps, so a cross-screen drag cannot emit thousands. */
    maxSteps?: number;
    /** Points the path must pass through, in order. */
    via?: Point[];
    /**
     * Sideways wander, in pixels. A person's pointer does not travel in a
     * straight line, and UI that samples the path — a freehand tool, a
     * gesture recogniser — will only ever see straight lines under test
     * unless something bends them.
     */
    curvePx?: number;
    random?: () => number;
}
export declare const DEFAULT_STEP_PX = 24;
export declare const DEFAULT_MAX_STEPS = 120;
/** The points a pointer visits going from `from` to `to`. */
export declare function pathBetween(from: Point, to: Point, options?: PathOptions): Point[];
/** `point` nudged by up to `radius` px, deterministically. */
export declare function jitter(point: Point, radius: number, random: () => number): Point;
//# sourceMappingURL=motion.d.ts.map