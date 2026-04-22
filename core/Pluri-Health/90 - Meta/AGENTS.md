---
tags:
  - meta
  - processo
kind: meta
area: governanca
aliases:
  - AGENTS
---
# AGENTS

## Objective

This repository should be handled with a TDD-first workflow. Before using Git commands that change history or stage work, validate the change with the project's available checks and record any pre-existing failures.

## Shell Setup

This environment may open with `/bin/sh` without loading Node automatically.

Before any Node, npm, npx, Vitest, Vite, or Supabase CLI command, run:

```sh
. ~/.profile
```

If needed, verify:

```sh
node -v
npm -v
npx -v
```

## TDD Workflow

Follow this order whenever implementing or fixing behavior:

1. Understand the affected behavior and identify the smallest testable unit.
2. Capture the baseline before editing.
3. Write or update a test that reproduces the bug or expected behavior.
4. Run the smallest relevant test command and confirm it fails for the expected reason.
5. Implement the minimal code change required.
6. Re-run the targeted test until it passes.
7. Run broader verification for the touched area.
8. Run the final quality gate before using Git.

## Baseline Checks

Before substantial edits, prefer this sequence:

```sh
. ~/.profile
npm run test
npm run build
npm run lint
```

If one or more commands already fail before the change:

- note that the failure is pre-existing;
- avoid claiming a clean pass later;
- do not fix unrelated failures unless the user asked for that work;
- still run the most relevant targeted tests for the requested change.

## Preferred Test Commands

Use the narrowest command first, then expand:

```sh
. ~/.profile
npm run test
```

For full validation before finishing:

```sh
. ~/.profile
npm run test
npm run build
npm run lint
```

If the task changes Supabase setup or local environment behavior, also use the relevant commands when available:

```sh
. ~/.profile
npm run supabase:status
npm run dev:local
```

## Git Gate

Do not use `git add`, `git commit`, `git merge`, or other write-oriented Git commands until one of these is true:

- the relevant tests for the task pass;
- `npm run build` passes;
- `npm run lint` passes, or any remaining lint failures are confirmed to be pre-existing and unrelated.

Before Git commands, run:

```sh
git status --short
git diff --stat
```

Before a commit, review the exact patch:

```sh
git diff
```

Then use Git in this order:

```sh
git add <files>
git commit -m "<clear message>"
```

## Final Reporting

When finishing a task, always report:

- what changed;
- which commands were run;
- which commands passed;
- which commands failed;
- whether any failure was pre-existing or introduced by the change.
