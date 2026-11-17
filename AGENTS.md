# Agent guidelines

`gs-ui-probe` drives a web UI the way a person does: interpolated pointer
travel, real drags, real keystrokes, aimed at anything you can point at —
including positions that are not elements. Playwright underneath. It knows
nothing about any application. [`README.md`](README.md) carries the rationale
and the full API; read it first, it is written for someone using the library
and this file is written for someone changing it.

## Authority order

1. Mechanical gates: `tsc`, `vitest`, the committed-`dist/` check.
2. This file.
3. `README.md`.

## Project boundaries — the one rule that matters

**No application vocabulary enters this repository.** `Probe` is the bottom
layer of three:

```
scenario    "build the circuit"        — calls actions only
actions     placeBlock, wirePorts, …   — calls the probe only
gs-ui-probe click, drag, press         — knows nothing about your app
```

The middle layer lives in the consuming repository. A method named for a
domain concept — `wirePorts`, `placeComponent`, `selectNode` — belongs there,
however convenient it would be here. The moment this library knows what a port
is, it stops being usable by the next application and starts needing a release
every time that one application changes.

Two consequences worth stating, because both are tempting:

- A new action is justified by a *pointer or keyboard* behaviour that callers
  cannot express by composing the existing ones, never by a caller's use case.
  `marquee` qualifies: a rubber-band selection is a press, a path and a
  release that no sequence of `click` and `moveTo` produces. A `placeBlock`
  does not qualify, whatever it would save its caller.
- `PageLike` stays the smallest interface this library actually calls. It
  exists so a recording fake substitutes for a browser in the tests; every
  method added to it is a method that fake must grow, and a reason the next
  consumer's page object might not fit.

Playwright is a **peer** dependency on purpose: the consumer owns the browser,
the version and the test runner. Do not promote it to a direct dependency.

## Required gates

Run all three before pushing, never after:

```bash
pnpm install --frozen-lockfile
pnpm typecheck     # tsc --noEmit, strict, no ambient type packages
pnpm test          # 36 unit tests against the PageLike fake, no browser
pnpm check-dist    # pnpm build, then: does dist/ match what is committed?
```

CI runs exactly these on every push to `main` and every pull request, plus a
Conventional Commits check on the pull request's subjects.

`"types": []` in `tsconfig.json` is deliberate and should stay. Nothing here
touches a Node API, and an empty list stops `tsc` pulling in whatever
`@types/*` it finds walking up from the checkout. With `["node"]` the typecheck
passed for a year on a workstation that happened to have `@types/node` in
`$HOME` and failed on every clean machine; CI found it on its first run (#7).

## `dist/` is committed, and that is not an accident

Consumers install this package straight from git rather than from a registry,
so the committed build output is what they load. A `prepare` script would
force every consumer — and every CI runner that depends on them — to clone
this repository and run a full TypeScript install just to obtain the build.

The price is that `src/` and `dist/` can disagree. A commit that edits `src/`
and forgets `pnpm build` passes the typecheck and all the tests, because both
read `src/`, and ships the previous behaviour to every consumer. `pnpm
check-dist` is what keeps that honest, in CI and before a push. So a release
is:

```bash
pnpm build                       # refresh dist/ — consumers see this, not src/
pnpm typecheck && pnpm test
git commit -am "..." && git tag vX.Y.Z && git push --follow-tags
```

Then bump the tag in whatever depends on it.

## Testing discipline

The tests run against `tests/fake-page.ts`, a recorder implementing the
`PageLike` methods, and assert on the event stream it captures: how many moves
a leg produced, where they landed, the easing, the anchor arithmetic, which
modifiers were held and released, what the trace recorded. That is the right
shape for this library's own logic and it needs no browser, which is why 36
tests run in under a second.

Be clear about what it therefore does not prove. Nothing in this suite shows
that a real DOM accepts the emitted sequence as a drag, that `doubleClick`
coalesces into a `dblclick` rather than two independent clicks, or that
`press("Control+Z")` arrives with `ctrlKey` set. Those are exactly the bugs
this library was written to catch, and they are currently invisible to it, for
the same structural reason as the spec described in `README.md`'s opening. That
gap is issue #5, filed rather than half-built: a browser-backed suite against
a static fixture page. Until it exists, a change to the event sequence a
browser sees is a change this repository cannot verify — say so in the pull
request instead of implying the green tick covers it.

**Jitter and curvature are seeded.** `seed` exists so a failure reproduces. A
test that depends on randomness without fixing the seed is a test that will
fail for someone else, once, unreproducibly.

## Development cycle

The gates above say how code is written. This says how the work is recorded,
which matters for the same reason: someone reads it later, and what they can
reconstruct is what was written down.

1. **A large instruction becomes a milestone**, named for the outcome rather
   than the task ("Docs and CI", not "add a workflow").
2. **One issue per deliverable phase or decision**, each stating the problem
   rather than the patch. The instruction as a whole — its reasoning, what it
   leaves open — is an issue in that milestone too, and the rest reference it
   with `Part of #N`.
3. **A branch and a pull request per issue**, the description ending
   `Closes #N`, assigned to the milestone. Nothing lands on the default branch
   directly.
4. **The merge closes the issue.** Closing it by hand loses the link between
   the issue and the commit that answered it, which is the whole point of the
   exercise.
5. **Anything found but not done becomes its own issue**, not a sentence in a
   pull request body. A merged pull request's prose is invisible; an open issue
   is not. A deliberate omission with a reason is worth more than a
   half-finished corner of a change.
6. **Gates run before pushing**, never after. A red branch spends someone's CI
   and tells the reader the author did not look.

Finish this repository's open pull request before starting new work in it, so
review has one thing to hold at a time.

## Commit messages

Conventional Commits, enforced by CI on pull requests: `feat`, `fix`, `docs`,
`style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. The subject says
what changed; the body says why it needed to, and what was verified rather
than assumed.

Commits use the GitHub no-reply address, never a personal one. Check
`git config user.email` before the first commit in a fresh clone.
