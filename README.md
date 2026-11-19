# gs-ui-probe

Drive a web UI the way a person does: real pointer travel, real drags, real
keystrokes — against anything you can point at, including things that are not
elements.

Playwright underneath. It knows nothing about any application.

```ts
import { Probe } from "gs-ui-probe";

const probe = new Probe(page);

await probe.click(page.getByRole("button", { name: "Run" }));
await probe.drag(sourcePort, targetPort, { via: [{ x: 400, y: 200 }] });
await probe.press("Control+Z");
```

## Install

Not on npm. The package is consumed straight from git — which is why `dist/` is committed —
so a tag is the version you pin:

```sh
pnpm add git+https://github.com/GLODI-Engineering/gs-ui-probe#v0.2.2
npm  install github:GLODI-Engineering/gs-ui-probe#v0.2.2
```

`@playwright/test` >= 1.40 is a **peer** dependency: `Probe` wraps a Playwright `Page` and
brings no browser of its own, so it uses the one your suite already installs. Nothing else is
required at runtime.

## Why it exists

An end-to-end test that fakes the interesting part tests nothing. The suite
this was extracted from had a file called `rc-circuit-manual-video.spec.ts`
which moved the mouse from one component's centre to another's and then
called `__gensim_wire_electrical(...)` to create the wire. It looked like a
mouse test. No wire was ever drawn by mouse, and every bug in the wiring
interaction was invisible to it.

Three things make the difference between that and a test that would have
caught them:

**The journey, not the endpoints.** `mouse.move(x, y)` dispatches one
`mousemove`. Plenty of UI never notices — a drag that only reads `mousedown`
and `mouseup` works fine. But a canvas drawing a live preview, a drop zone
that highlights on hover, a gesture that needs a movement threshold crossed:
each sees one event where a person produces fifty, and behaves differently
under test than in front of a user. `Probe` interpolates, with easing,
because a hand accelerates away from rest and slows into the target, and UI
that measures pointer velocity can tell.

**Aiming at things that are not elements.** On a canvas the positions that
matter are computed: the tip of a connector, a grid intersection, a spot
30 px right of a node. A library that only accepts locators pushes all of
that back onto the caller as hand-rolled `boundingBox()` arithmetic, which is
where the bugs live. So everything takes a `Target`: an element, an anchored
element, a point, or a function that works one out when the action runs —
the last one because a drag's destination often depends on what the drag
itself moved.

**Saying what it did.** A failure reports "expected 2 wires, got 1". The
useful question is which of the fourteen actions before it did not do what it
looked like it did. Every action is recorded, and a failure carries the
history with it.

## Targets

```ts
probe.click(locator)                                   // centre of an element
probe.click({ element: locator, anchor: "topLeft" })   // a corner of it
probe.click({ element: locator, anchor: "right", offset: { x: 12 } })
probe.click({ x: 420, y: 300 })                        // a point
probe.click(async () => portTipOf("R1", "p"))          // worked out on the spot
```

Anchors: `center` (default), `top`, `bottom`, `left`, `right`, `topLeft`,
`topRight`, `bottomLeft`, `bottomRight`.

## Actions

| | |
|---|---|
| `moveTo(target)` | travel there |
| `click(target, {button, modifiers, clickCount})` | |
| `doubleClick(target)` | a real double-click, not two clicks — a UI listening for `dblclick` never hears two independent ones |
| `rightClick(target)` | |
| `drag(from, to, {via, modifiers, holdMs, dropDelayMs})` | |
| `dragBy(from, dx, dy)` | |
| `marquee(from, to)` | rubber-band |
| `wheel(target, deltaY, deltaX?)` | |
| `press("Control+Z")` or `press(["Escape", "Enter"])` | |
| `type(text, {delayMs})` | |
| `withModifiers(mods, fn)` | held for the duration, released even if `fn` throws |
| `settle(ms?)` | |

## Options

```ts
new Probe(page, {
  stepPx: 24,      // distance between move events
  maxSteps: 120,   // cap per leg, so a cross-screen drag is not thousands
  settleMs: 60,    // pause after each action
  jitterPx: 0,     // how far off target the pointer may land
  curvePx: 0,      // sideways wander on a drag path
  seed: 1,         // makes jitter and curvature reproducible
  typeDelayMs: 20,
  onAction: (a) => console.log(a),
});
```

`probe.with({...})` returns a variant without disturbing the original.

**On jitter.** Raise it to find hit targets that are smaller than they look.
Keep it well below the real tolerance of what you are aiming at, or you are
testing the jitter rather than the UI. It is seeded, so a failure reproduces.

**On `holdMs`.** Some UI only begins a drag after the pointer has been held
still for a moment, or needs a frame to set up a preview. Pressing and moving
in the same tick skips that and the drag silently does nothing.

## Layering

`Probe` is the bottom layer and stays generic. Application vocabulary goes
above it:

```
scenario    "build the circuit"        — calls actions only
actions     placeBlock, wirePorts, …   — calls the probe only
gs-ui-probe click, drag, press         — knows nothing about your app
```

Keep the middle layer in your own repo. If an action needs a concept from
your domain, it belongs there, not here.

## What it did: `probe.trace`

Every action is recorded on `probe.trace` as it happens, and a failing action throws with the
whole history attached — because the action that throws is rarely the one that was wrong.

```ts
import { describeAction, Probe } from "gs-ui-probe";

const probe = new Probe(page, { onAction: (a) => console.log(describeAction(a)) });

probe.trace.note("build the divider");
await probe.click(addResistor);
await probe.drag(sourcePort, targetPort);
await probe.press("Control+S");

console.log(probe.trace.format());
```

```text
what the probe did:
     0ms -- build the divider
     0ms    click (120, 80)
     1ms    drag (120, 80) -> (320, 80)
     1ms    press Control+S
```

| member | what it gives you |
| --- | --- |
| `trace.actions` | `RecordedAction[]` — each with `at`, `durationMs` and `failed` when it threw |
| `trace.format()` | the block above, as a string; this is what an action's error message carries |
| `trace.note(text)` | a free-text marker, printed with `--`, for structuring a long scenario |
| `trace.clear()` | forget everything so far, for a per-step assertion |
| `onAction` option | a callback per action, for streaming into your own reporter |

Besides `Probe`, the package exports the pieces it is built from, so a caller can aim and
measure without going through an action: `anchorPoint` and `resolveTarget` (where a target
actually is), `pathBetween` with `easeInOutCubic` and `jitter` (the motion a drag would take),
`distance`, `describeTarget`, `describeAction`, and `TargetNotVisibleError`, which is what a
target that cannot be aimed at throws.

## Testing it

`PageLike` is the handful of methods this library actually uses, so a fake
that records events substitutes for a browser:

```sh
pnpm test        # 36 unit tests, no browser
pnpm typecheck
```

## Releasing

`dist/` is committed, because this package is consumed straight from git rather
than a registry. A `prepare` script would make every consumer — and every CI
runner — clone the repository and run a full install with a TypeScript
toolchain just to get the build; shipping the output avoids all of it.

So a change is two steps, and the first is easy to forget:

```bash
pnpm build          # refresh dist/ — the consumer sees this, not src/
pnpm typecheck && pnpm test
git commit -am "..." && git tag vX.Y.Z && git push --follow-tags
```

Then bump the tag in whatever depends on it.
