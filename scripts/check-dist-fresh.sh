#!/usr/bin/env bash
#
# `dist/` is committed, because consumers install this package straight from
# git (see README.md, "Releasing"). That makes the build output the artefact
# people actually load, and makes a forgotten `pnpm build` a silent bug: the
# source is correct, the tests pass, and every consumer runs the old code.
#
# This rebuilds `dist/` and fails if the result differs from what is committed.
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain -- dist 2>/dev/null)" ]; then
  echo "error: dist/ already differs from HEAD before building." >&2
  echo "       Commit or discard those changes first, or this check cannot" >&2
  echo "       tell a stale build from an uncommitted one." >&2
  git status --short -- dist >&2
  exit 1
fi

pnpm build

# Tracked files that changed, plus files the build newly created: a new module
# in `src/` produces a `dist/` file that git has never seen, and `git diff`
# alone says nothing about those.
changed="$(git status --porcelain -- dist)"

if [ -z "$changed" ]; then
  echo "dist/ is in sync with src/."
  exit 0
fi

cat >&2 <<'MSG'
error: dist/ does not match a fresh build of src/.

The committed build output is what consumers of this package load — they
install it from git, not from a registry, so nothing rebuilds it for them.
A commit that changes src/ without refreshing dist/ ships the previous
behaviour while the repository looks correct.

Files that differ:
MSG

echo "$changed" >&2
echo >&2
echo "Fix: pnpm build && git add dist && git commit --amend --no-edit" >&2
echo "     (or commit the refreshed dist/ separately)" >&2

exit 1
