import { describe, expect, it } from "vitest";

import { Probe } from "../src/probe.js";
import { FakePage, fakeElement, missingElement } from "./fake-page.js";

function probeOn(page: FakePage, options = {}) {
  return new Probe(page, { settleMs: 0, ...options });
}

const button = fakeElement({ x: 100, y: 100, width: 80, height: 40 });

describe("aiming", () => {
  it("aims at an element's centre by default", async () => {
    const page = new FakePage();
    await probeOn(page).click(button);
    expect(page.moves().at(-1)).toEqual({ x: 140, y: 120 });
  });

  it("aims at an anchor when asked", async () => {
    const page = new FakePage();
    await probeOn(page).click({ element: button, anchor: "topLeft" });
    expect(page.moves().at(-1)).toEqual({ x: 100, y: 100 });
  });

  it("applies an offset after the anchor", async () => {
    const page = new FakePage();
    await probeOn(page).click({ element: button, anchor: "right", offset: { x: 10 } });
    expect(page.moves().at(-1)).toEqual({ x: 190, y: 120 });
  });

  it("takes a bare point, for things that are not elements", async () => {
    // On a canvas the interesting positions are computed, not rendered.
    const page = new FakePage();
    await probeOn(page).click({ x: 42, y: 99 });
    expect(page.moves().at(-1)).toEqual({ x: 42, y: 99 });
  });

  it("takes a function, resolved when the action runs", async () => {
    // A drag's destination often depends on what the drag itself moved, so
    // resolving every target up front would be wrong.
    const page = new FakePage();
    let where = { x: 10, y: 10 };
    const probe = probeOn(page);
    await probe.click(() => where);
    where = { x: 300, y: 300 };
    await probe.click(() => where);
    expect(page.moves().at(-1)).toEqual({ x: 300, y: 300 });
  });

  it("says plainly when a target is not on screen", async () => {
    const page = new FakePage();
    await expect(probeOn(page).click(missingElement())).rejects.toThrow(/no bounding box/);
    await expect(probeOn(page).click(missingElement())).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining("not visible") }),
    );
  });
});

describe("clicking", () => {
  it("presses and releases, having travelled there first", async () => {
    const page = new FakePage();
    await probeOn(page).click(button);
    expect(page.kinds().slice(-2)).toEqual(["down", "up"]);
    expect(page.moves().length).toBeGreaterThan(1);
  });

  it("sends a real double-click, not two clicks", async () => {
    // A UI listening for `dblclick` never hears two independent clicks.
    const page = new FakePage();
    await probeOn(page).doubleClick(button);
    const counts = page.events
      .filter((e) => e.type === "down")
      .map((e) => (e as { clickCount: number }).clickCount);
    expect(counts).toEqual([1, 2]);
  });

  it("right-clicks with the right button", async () => {
    const page = new FakePage();
    await probeOn(page).rightClick(button);
    expect(page.events.find((e) => e.type === "down")).toMatchObject({ button: "right" });
  });

  it("holds modifiers around the press and releases them after", async () => {
    const page = new FakePage();
    await probeOn(page).click(button, { modifiers: ["Shift", "Control"] });
    expect(page.kinds()).toEqual([
      ...Array(page.moves().length).fill("move"),
      "keydown",
      "keydown",
      "down",
      "up",
      "keyup",
      "keyup",
    ]);
  });

  it("releases modifiers even when the action throws", async () => {
    // Otherwise one failure leaves Shift held and every later test in the
    // file does something subtly different.
    const page = new FakePage();
    const probe = probeOn(page);
    await expect(
      probe.withModifiers(["Shift"], async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(page.kinds()).toEqual(["keydown", "keyup"]);
  });
});

describe("dragging", () => {
  it("presses, travels, and releases — in that order", async () => {
    const page = new FakePage();
    await probeOn(page).drag({ x: 0, y: 0 }, { x: 200, y: 0 });
    const kinds = page.kinds();
    const down = kinds.indexOf("down");
    const up = kinds.indexOf("up");
    expect(down).toBeGreaterThanOrEqual(0);
    expect(up).toBeGreaterThan(down);
    // The journey is the point: a drag implemented as press-jump-release
    // exercises none of the dragging.
    expect(kinds.slice(down, up).filter((k) => k === "move").length).toBeGreaterThan(3);
  });

  it("passes through waypoints", async () => {
    const page = new FakePage();
    await probeOn(page).drag({ x: 0, y: 0 }, { x: 200, y: 0 }, { via: [{ x: 100, y: 100 }] });
    expect(page.moves().some((m) => Math.hypot(m.x - 100, m.y - 100) < 1e-6)).toBe(true);
  });

  it("holds after pressing, so a drag that needs a beat to start can start", async () => {
    const page = new FakePage();
    await new Probe(page, { settleMs: 0 }).drag({ x: 0, y: 0 }, { x: 50, y: 0 }, { holdMs: 75 });
    const downIndex = page.events.findIndex((e) => e.type === "down");
    expect(page.events[downIndex + 1]).toEqual({ type: "wait", ms: 75 });
  });

  it("dragBy moves relative to where it started", async () => {
    const page = new FakePage();
    await probeOn(page).dragBy(button, 60, -20);
    expect(page.moves().at(-1)).toEqual({ x: 200, y: 100 });
  });
});

describe("keyboard", () => {
  it("presses a sequence in order", async () => {
    const page = new FakePage();
    await probeOn(page).press(["Escape", "Control+Z"]);
    expect(page.events.filter((e) => e.type === "keypress")).toEqual([
      { type: "keypress", key: "Escape" },
      { type: "keypress", key: "Control+Z" },
    ]);
  });

  it("types text", async () => {
    const page = new FakePage();
    await probeOn(page).type("100k");
    expect(page.events.find((e) => e.type === "text")).toEqual({ type: "text", text: "100k" });
  });
});

describe("jitter", () => {
  it("is off by default, so a test can be exact", async () => {
    const page = new FakePage();
    await probeOn(page).click(button);
    expect(page.moves().at(-1)).toEqual({ x: 140, y: 120 });
  });

  it("lands within the radius when enabled, and repeats for a seed", async () => {
    // Raise it to find hit targets smaller than they look; keep it under
    // the real tolerance or you are testing the jitter.
    const run = async () => {
      const page = new FakePage();
      await probeOn(page, { jitterPx: 5, seed: 17 }).click(button);
      return page.moves().at(-1) ?? { x: 0, y: 0 };
    };
    const first = await run();
    expect(Math.hypot(first.x - 140, first.y - 120)).toBeLessThanOrEqual(5 + 1e-9);
    expect(await run()).toEqual(first);
  });
});

describe("the trace", () => {
  it("records what was done, in order", async () => {
    const page = new FakePage();
    const probe = probeOn(page);
    probe.trace.note("setting up");
    await probe.click(button);
    await probe.drag({ x: 0, y: 0 }, { x: 10, y: 10 });
    await probe.press("Enter");
    expect(probe.trace.format()).toContain("setting up");
    expect(probe.trace.format()).toContain("click");
    expect(probe.trace.format()).toContain("drag");
    expect(probe.trace.format()).toContain("press Enter");
  });

  it("attaches the history to a failure, because the action that threw is rarely the wrong one", async () => {
    const page = new FakePage();
    const probe = probeOn(page);
    await probe.click(button);
    await expect(probe.click(missingElement())).rejects.toThrow(/what the probe did/);
  });

  it("reports each action as it happens, for a live log", async () => {
    const page = new FakePage();
    const seen: string[] = [];
    const probe = new Probe(page, { settleMs: 0, onAction: (a) => seen.push(a.kind) });
    await probe.click(button);
    await probe.press("Enter");
    expect(seen).toEqual(["click", "press"]);
  });
});

describe("configuration", () => {
  it("with() makes a variant without disturbing the original", async () => {
    const page = new FakePage();
    const slow = probeOn(page);
    const precise = slow.with({ jitterPx: 0, stepPx: 4 });
    await precise.click(button);
    const fineMoves = page.moves().length;
    page.events.length = 0;
    await slow.click(button);
    expect(fineMoves).toBeGreaterThan(page.moves().length);
  });

  it("settles after each action, because a burst with no gap is what nobody does", async () => {
    const page = new FakePage();
    await new Probe(page, { settleMs: 33 }).click(button);
    expect(page.events.at(-1)).toEqual({ type: "wait", ms: 33 });
  });
});
