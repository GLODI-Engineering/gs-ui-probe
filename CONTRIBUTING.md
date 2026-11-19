# Contributing

This library drives a UI the way a person does. Everything below exists to keep that claim
true.

## Gates, before pushing

```sh
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run -- 36 unit tests, no browser
pnpm build         # tsc -p tsconfig.build.json
pnpm check-dist    # dist/ matches src/
```

`dist/` is committed, because this package is consumed straight from git rather than from a
registry. `check-dist` is what stops a published tag from carrying a stale build: run `pnpm
build` and commit the result in the same change as the source.

## Development cycle

A large instruction becomes a **milestone**, named for the outcome rather than the task. One
**issue per deliverable or decision**, each stating the problem rather than the patch; the
instruction as a whole is an issue in that milestone too, and the rest reference it with
`Part of #N`. A **branch and a pull request per issue**, the description ending `Closes #N`,
assigned to the milestone — nothing lands on the default branch directly, and **the merge
closes the issue**, because closing it by hand loses the link between the issue and the commit
that answered it. Anything **found but not done becomes its own issue**, not a sentence in a
pull request body.

Finish this repository's open pull request before starting new work in it, so review has one
thing to hold at a time.

## What belongs here

`Probe` stays generic: it knows about pointers, keys and targets, and nothing about any
application. Application vocabulary — `placeBlock`, `wirePorts`, a scenario — belongs in the
repository that has the application. See **Layering** in the README.

A new action earns its place by being something a person does that Playwright's own API does
not reproduce faithfully. An action that is a one-line call to `page.mouse` does not need to be
here.

## Testing discipline

The unit suite runs against `tests/fake-page.ts`, which records the event stream instead of
rendering it. That is the right harness for the library's own arithmetic — interpolation,
easing, step counts, anchor maths, modifier bookkeeping — and it is deliberately *not* proof
that a real DOM accepts the event sequence as a drag. That gap is tracked in
[#5](https://github.com/GLODI-Engineering/gs-ui-probe/issues/5); a new action's events should be
checked against a real browser once, by hand, until it closes.

## Releasing

See **Releasing** in the README: bump `package.json`, rebuild `dist/`, tag `vX.Y.Z`. Consumers
pin the tag, so a tag that was never built from its own source is the one failure mode that
matters.
