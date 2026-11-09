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
export type Anchor = "center" | "top" | "bottom" | "left" | "right" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
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
export type Target = HasBoundingBox | AnchoredTarget | Point | (() => Point | Promise<Point>);
export declare function isPoint(value: unknown): value is Point;
/** The point an anchor names within a box. */
export declare function anchorPoint(box: BoxLike, anchor?: Anchor): Point;
export declare class TargetNotVisibleError extends Error {
    constructor(label: string);
}
/** Resolve a target to a viewport coordinate. */
export declare function resolveTarget(target: Target, label?: string): Promise<Point>;
/** Describe a target for a trace line, without touching the page. */
export declare function describeTarget(target: Target, fallback?: string): string;
export declare function distance(a: Point, b: Point): number;
//# sourceMappingURL=geometry.d.ts.map