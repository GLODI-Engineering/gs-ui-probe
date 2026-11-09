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
export function isPoint(value) {
    return (typeof value === "object" &&
        value !== null &&
        typeof value.x === "number" &&
        typeof value.y === "number" &&
        !("boundingBox" in value));
}
function isAnchored(value) {
    return typeof value === "object" && value !== null && "element" in value;
}
function hasBoundingBox(value) {
    return (typeof value === "object" &&
        value !== null &&
        typeof value.boundingBox === "function");
}
/** The point an anchor names within a box. */
export function anchorPoint(box, anchor = "center") {
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
    constructor(label) {
        super(`Cannot aim at ${label}: it has no bounding box. ` +
            "It is probably not attached, not visible, or has zero size.");
        this.name = "TargetNotVisibleError";
    }
}
/** Resolve a target to a viewport coordinate. */
export async function resolveTarget(target, label = "target") {
    if (typeof target === "function") {
        return await target();
    }
    if (isAnchored(target)) {
        const box = await target.element.boundingBox();
        if (!box)
            throw new TargetNotVisibleError(target.as ?? label);
        const base = anchorPoint(box, target.anchor);
        return {
            x: base.x + (target.offset?.x ?? 0),
            y: base.y + (target.offset?.y ?? 0),
        };
    }
    if (hasBoundingBox(target)) {
        const box = await target.boundingBox();
        if (!box)
            throw new TargetNotVisibleError(label);
        return anchorPoint(box, "center");
    }
    if (isPoint(target)) {
        return { x: target.x, y: target.y };
    }
    throw new TypeError(`Not a target: ${String(target)}`);
}
/** Describe a target for a trace line, without touching the page. */
export function describeTarget(target, fallback = "point") {
    if (typeof target === "function")
        return "computed point";
    if (isAnchored(target)) {
        const anchor = target.anchor && target.anchor !== "center" ? ` ${target.anchor}` : "";
        return `${target.as ?? "element"}${anchor}`;
    }
    if (isPoint(target))
        return `(${Math.round(target.x)}, ${Math.round(target.y)})`;
    if (hasBoundingBox(target)) {
        // Playwright locators stringify to something readable; anything else
        // falls back to the label the caller gave.
        const described = String(target);
        return described === "[object Object]" ? fallback : described;
    }
    return fallback;
}
export function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}
//# sourceMappingURL=geometry.js.map