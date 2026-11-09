import { describe, expect, it } from "vitest";

import { DEFAULT_STEP_PX, easeInOutCubic, jitter, makeRandom, pathBetween } from "../src/motion.js";

const from = { x: 0, y: 0 };
const to = { x: 400, y: 0 };

describe("pathBetween", () => {
  it("emits many events, not one", () => {
    // The reason the library exists: UI that tracks motion — a live wire
    // preview, a drop zone that highlights on hover, a gesture with a
    // movement threshold — sees one event where a person produces fifty,
    // and behaves differently under test than in front of a user.
    const path = pathBetween(from, to, { stepPx: DEFAULT_STEP_PX });
    expect(path.length).toBeGreaterThan(10);
  });

  it("finishes exactly on the target", () => {
    // Anything less and a drop lands next to the thing it was aimed at.
    const path = pathBetween(from, to, { curvePx: 30, random: makeRandom(7) });
    expect(path.at(-1)).toEqual(to);
  });

  it("passes through every waypoint, in order", () => {
    const via = [
      { x: 100, y: 200 },
      { x: 300, y: 50 },
    ];
    const path = pathBetween(from, to, { via });
    for (const point of via) {
      expect(path.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 1e-6)).toBe(true);
    }
    const firstIndex = path.findIndex((p) => Math.hypot(p.x - 100, p.y - 200) < 1e-6);
    const secondIndex = path.findIndex((p) => Math.hypot(p.x - 300, p.y - 50) < 1e-6);
    expect(firstIndex).toBeLessThan(secondIndex);
  });

  it("respects the step cap, so a cross-screen drag is not thousands of events", () => {
    const path = pathBetween(from, { x: 100_000, y: 0 }, { stepPx: 1, maxSteps: 50 });
    expect(path.length).toBeLessThanOrEqual(50);
  });

  it("does not move at all when it is already there", () => {
    expect(pathBetween(from, from)).toEqual([from]);
  });

  it("bows off the straight line when asked, and not otherwise", () => {
    const offAxis = (curvePx: number) =>
      Math.max(...pathBetween(from, to, { curvePx, random: makeRandom(3) }).map((p) => Math.abs(p.y)));
    expect(offAxis(0)).toBe(0);
    expect(offAxis(40)).toBeGreaterThan(1);
  });

  it("is deterministic for a given seed", () => {
    const run = () => pathBetween(from, to, { curvePx: 40, random: makeRandom(99) });
    expect(run()).toEqual(run());
  });
});

describe("easeInOutCubic", () => {
  it("starts and ends at rest", () => {
    // A hand accelerates away from rest and slows into the target. UI that
    // measures pointer velocity — inertial panning, flick gestures — can
    // tell the difference from a constant-speed sweep.
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("jitter", () => {
  it("stays inside the radius it was given", () => {
    const random = makeRandom(11);
    for (let i = 0; i < 200; i++) {
      const moved = jitter({ x: 50, y: 50 }, 4, random);
      expect(Math.hypot(moved.x - 50, moved.y - 50)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it("is a no-op at radius zero, so a test can be exact when it needs to be", () => {
    expect(jitter({ x: 1, y: 2 }, 0, makeRandom(1))).toEqual({ x: 1, y: 2 });
  });
});

describe("makeRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const a = makeRandom(42);
    const b = makeRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives different sequences for different seeds", () => {
    expect(makeRandom(1)()).not.toBe(makeRandom(2)());
  });
});
