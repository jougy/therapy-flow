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

## Supabase Production

This repository's current production Supabase project is:

- project ref: `pmnwwdmgxzawsxzpnigw`
- project URL: `https://pmnwwdmgxzawsxzpnigw.supabase.co`

When using the Supabase CLI for remote operations, prefer the latest CLI explicitly:

```sh
. ~/.profile
npx supabase@latest --version
```

## Migration Publish Workflow

Whenever a task adds or changes files in `supabase/migrations`, follow this flow before finishing the task unless the user explicitly says not to publish remote changes yet:

1. Review the migration file contents carefully.
2. Validate the codebase with the relevant checks for the task.
3. Confirm Supabase CLI access to the production project.
4. Link the local repository to the production project.
5. Run a dry run when appropriate.
6. Push pending migrations to the linked remote project.
7. Confirm the linked migration status.
8. Report clearly whether the migration was actually published or whether it was blocked.

Use this command sequence:

```sh
. ~/.profile
npx supabase@latest projects list
npx supabase@latest link --project-ref pmnwwdmgxzawsxzpnigw
npx supabase@latest db push --dry-run
npx supabase@latest db push
npx supabase@latest migration list --linked
```

If a migration should be published and the project is already linked, still verify with:

```sh
. ~/.profile
npx supabase@latest migration list --linked
```

## Supabase Access Troubleshooting

If `supabase link` fails with `Forbidden resource` or the CLI says it cannot find the project ref:

- do not claim the migration was published;
- do not continue to `db push` as if the project were linked;
- verify access with `npx supabase@latest projects list`;
- if the target project does not appear, assume the CLI is authenticated with the wrong account or a token without access;
- re-authenticate using a personal access token from the Supabase dashboard;
- retry `link` only after access is confirmed.

Preferred recovery flow:

```sh
. ~/.profile
npx supabase@latest login --token "<personal-access-token>"
npx supabase@latest projects list
npx supabase@latest link --project-ref pmnwwdmgxzawsxzpnigw
```

Never say a migration was applied to production unless `npx supabase@latest db push` completed successfully.

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
