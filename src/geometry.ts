/**
 * Points, anchors, and turning "that thing on screen" into a coordinate.
 *
 * Everything in this library takes a `Target` rather than a Playwright
 * `Locator`, because the things people point at are not always elements. On
 * a canvas the interesting positions are computed — the tip of a connector,
 * a grid intersection, a spot 30 px right of a node — and a library that
 * only accepts locators pushes all of that back onto the caller as
 * hand-rolled `boundingBox()` arithmetic, which is where the bugs live.
 */

export interface Point {
  x: number;
  y: number;
}

/** Which part of an element's box to aim at. */
export type Anchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

export interface BoxLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Anything with a `boundingBox()` — a Playwright Locator satisfies this. */
export interface HasBoundingBox {
  boundingBox(): Promise<BoxLike | null>;
}

export interface AnchoredTarget {
  element: HasBoundingBox;
  /** Defaults to "center". */
  anchor?: Anchor;
  /** Added after the anchor is resolved. */
  offset?: Partial<Point>;
  /** Shown in traces and errors instead of "<element>". */
  as?: string;
}

/**
 * Anything you can aim at: an element, an anchored element, a fixed point,
 * or a function that works one out when the action runs.
 *
 * The lazy form matters more than it looks. A drag's destination often
 * depends on where the drag started — or on something the drag itself moved
 * — so resolving every target up front would be wrong.
 */
export type Target =
  | HasBoundingBox
  | AnchoredTarget
  | Point
  | (() => Point | Promise<Point>);

export function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Point).x === "number" &&
    typeof (value as Point).y === "number" &&
    !("boundingBox" in value)
  );
}

function isAnchored(value: unknown): value is AnchoredTarget {
  return typeof value === "object" && value !== null && "element" in value;
}

function hasBoundingBox(value: unknown): value is HasBoundingBox {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HasBoundingBox).boundingBox === "function"
  );
}

/** The point an anchor names within a box. */
export function anchorPoint(box: BoxLike, anchor: Anchor = "center"): Point {
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;

  switch (anchor) {
    case "top":
      return { x: midX, y: top };
    case "bottom":
      return { x: midX, y: bottom };
    case "left":
      return { x: left, y: midY };
    case "right":
      return { x: right, y: midY };
    case "topLeft":
      return { x: left, y: top };
    case "topRight":
      return { x: right, y: top };
    case "bottomLeft":
      return { x: left, y: bottom };
    case "bottomRight":
      return { x: right, y: bottom };
    default:
      return { x: midX, y: midY };
  }
}

export class TargetNotVisibleError extends Error {
  constructor(label: string) {
    super(
      `Cannot aim at ${label}: it has no bounding box. ` +
        "It is probably not attached, not visible, or has zero size.",
    );
    this.name = "TargetNotVisibleError";
  }
}

/** Resolve a target to a viewport coordinate. */
export async function resolveTarget(target: Target, label = "target"): Promise<Point> {
  if (typeof target === "function") {
    return await target();
  }
  if (isAnchored(target)) {
    const box = await target.element.boundingBox();
    if (!box) throw new TargetNotVisibleError(target.as ?? label);
    const base = anchorPoint(box, target.anchor);
    return {
      x: base.x + (target.offset?.x ?? 0),
      y: base.y + (target.offset?.y ?? 0),
    };
  }
  if (hasBoundingBox(target)) {
    const box = await target.boundingBox();
    if (!box) throw new TargetNotVisibleError(label);
    return anchorPoint(box, "center");
  }
  if (isPoint(target)) {
    return { x: target.x, y: target.y };
  }
  throw new TypeError(`Not a target: ${String(target)}`);
}

/** Describe a target for a trace line, without touching the page. */
export function describeTarget(target: Target, fallback = "point"): string {
  if (typeof target === "function") return "computed point";
  if (isAnchored(target)) {
    const anchor = target.anchor && target.anchor !== "center" ? ` ${target.anchor}` : "";
    return `${target.as ?? "element"}${anchor}`;
  }
  if (isPoint(target)) return `(${Math.round(target.x)}, ${Math.round(target.y)})`;
  if (hasBoundingBox(target)) {
    // Playwright locators stringify to something readable; anything else
    // falls back to the label the caller gave.
    const described = String(target);
    return described === "[object Object]" ? fallback : described;
  }
  return fallback;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
