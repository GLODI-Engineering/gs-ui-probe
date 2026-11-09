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
/** Deterministic, seeded, and good enough for jitter. Mulberry32. */
export function makeRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * Ease-in-out. A real hand accelerates away from rest and slows into the
 * target; linear interpolation does neither, and UI that measures pointer
 * velocity (inertial panning, flick gestures) can tell.
 */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
export const DEFAULT_STEP_PX = 24;
export const DEFAULT_MAX_STEPS = 120;
function interpolate(from, to, stepPx, maxSteps, curvePx, random) {
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    if (span === 0)
        return [to];
    const steps = Math.max(1, Math.min(maxSteps, Math.ceil(span / Math.max(1, stepPx))));
    // One perpendicular bow per leg, not per step: a wobble applied per step
    // is noise, and noise is not what a hand does.
    const nx = -(to.y - from.y) / span;
    const ny = (to.x - from.x) / span;
    const bow = curvePx === 0 ? 0 : (random() * 2 - 1) * curvePx;
    const path = [];
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const eased = easeInOutCubic(t);
        // Half-sine: zero deflection at both ends, so the path still starts and
        // finishes exactly where it was asked to.
        const deflect = bow * Math.sin(Math.PI * t);
        path.push({
            x: from.x + (to.x - from.x) * eased + nx * deflect,
            y: from.y + (to.y - from.y) * eased + ny * deflect,
        });
    }
    // Land exactly on the target rather than near it. `sin(PI)` is 1.2e-16,
    // not 0, so the computed last point misses by ~1e-14 — harmless on its
    // own, but "the pointer ends where it was aimed" is the contract every
    // drop in every test depends on, and it should not rest on a floating
    // point identity that does not hold.
    path[path.length - 1] = { x: to.x, y: to.y };
    return path;
}
/** The points a pointer visits going from `from` to `to`. */
export function pathBetween(from, to, options = {}) {
    const { stepPx = DEFAULT_STEP_PX, maxSteps = DEFAULT_MAX_STEPS, via = [], curvePx = 0, random = Math.random, } = options;
    const legs = [...via, to];
    const path = [];
    let cursor = from;
    const perLeg = Math.max(2, Math.floor(maxSteps / legs.length));
    for (const leg of legs) {
        path.push(...interpolate(cursor, leg, stepPx, perLeg, curvePx, random));
        cursor = leg;
    }
    return path;
}
/** `point` nudged by up to `radius` px, deterministically. */
export function jitter(point, radius, random) {
    if (radius <= 0)
        return point;
    const angle = random() * Math.PI * 2;
    const distance = random() * radius;
    return {
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
    };
}
//# sourceMappingURL=motion.js.map