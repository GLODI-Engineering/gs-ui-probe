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
import { describeTarget, distance, resolveTarget, } from "./geometry.js";
import { DEFAULT_MAX_STEPS, DEFAULT_STEP_PX, jitter, makeRandom, pathBetween } from "./motion.js";
import { Trace } from "./trace.js";
export class Probe {
    trace;
    page;
    options;
    random;
    cursor = { x: 0, y: 0 };
    constructor(page, options = {}) {
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
    with(options) {
        return new Probe(this.page, { ...this.options, ...options });
    }
    /** Where the pointer is, as far as this probe knows. */
    get position() {
        return { ...this.cursor };
    }
    /** Resolve a target without moving. */
    async pointOf(target) {
        return await resolveTarget(target);
    }
    async moveTo(target) {
        const aim = jitter(await resolveTarget(target), this.options.jitterPx, this.random);
        return await this.trace.record({ kind: "move", to: describeTarget(target), px: Math.round(distance(this.cursor, aim)) }, async () => {
            await this.travel(aim);
            return aim;
        });
    }
    async click(target, options = {}) {
        const button = options.button;
        await this.trace.record({ kind: "click", to: describeTarget(target), ...(button ? { button } : {}) }, async () => {
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
        });
    }
    async doubleClick(target, options = {}) {
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
    async rightClick(target) {
        await this.click(target, { button: "right" });
    }
    /**
     * Press at `from`, travel to `to`, release.
     *
     * The journey is the point. A drag implemented as press-jump-release
     * exercises none of the dragging.
     */
    async drag(from, to, options = {}) {
        await this.trace.record({ kind: "drag", from: describeTarget(from), to: describeTarget(to) }, async () => {
            const start = jitter(await resolveTarget(from), this.options.jitterPx, this.random);
            await this.travel(start);
            await this.withModifiers(options.modifiers ?? [], async () => {
                await this.page.mouse.down({ button: options.button ?? "left" });
                await this.page.waitForTimeout(options.holdMs ?? 40);
                const via = [];
                for (const waypoint of options.via ?? [])
                    via.push(await resolveTarget(waypoint));
                const end = jitter(await resolveTarget(to), this.options.jitterPx, this.random);
                await this.travel(end, via);
                await this.page.waitForTimeout(options.dropDelayMs ?? 40);
                await this.page.mouse.up({ button: options.button ?? "left" });
            });
            await this.settle();
        });
    }
    /** Drag from a target by a pixel offset. */
    async dragBy(from, dx, dy, options = {}) {
        const origin = await resolveTarget(from);
        await this.drag(from, { x: origin.x + dx, y: origin.y + dy }, options);
    }
    /** Rubber-band from one corner to another. */
    async marquee(from, to, options = {}) {
        await this.drag(from, to, options);
    }
    async wheel(target, deltaY, deltaX = 0) {
        await this.trace.record({ kind: "wheel", to: describeTarget(target), px: deltaY }, async () => {
            await this.travel(await resolveTarget(target));
            await this.page.mouse.wheel(deltaX, deltaY);
            await this.settle();
        });
    }
    /** `press("Control+Z")`, or a sequence: `press(["Escape", "Enter"])`. */
    async press(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const key of list) {
            await this.trace.record({ kind: "press", key }, async () => {
                await this.page.keyboard.press(key);
                await this.settle();
            });
        }
    }
    async type(text, options = {}) {
        await this.trace.record({ kind: "type", text }, async () => {
            await this.page.keyboard.type(text, {
                delay: options.delayMs ?? this.options.typeDelayMs,
            });
            await this.settle();
        });
    }
    /** Hold modifiers for the duration of `body`, releasing them even if it throws. */
    async withModifiers(modifiers, body) {
        for (const modifier of modifiers)
            await this.page.keyboard.down(modifier);
        try {
            return await body();
        }
        finally {
            for (const modifier of [...modifiers].reverse())
                await this.page.keyboard.up(modifier);
        }
    }
    /** Pause, the way a person pauses between actions. */
    async settle(ms) {
        await this.page.waitForTimeout(ms ?? this.options.settleMs);
    }
    async travel(to, via = []) {
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
//# sourceMappingURL=probe.js.map