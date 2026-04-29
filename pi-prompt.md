# ISSUES

Issues are located at GS_MAIN/CURRENT-WORK/

Work on them in the order and only on issues that are not marked as DONE in progress.md file.

Read the PRD GS_MAIN/CURRENT-WORK/gamification-prd.md
Read the GS_MAIN/CURRENT-WORK/progress.md for better context.

# EXPLORATION

Explore the repo.

# FEEDBACK LOOPS

This is a pnpm + Turbo monorepo (NestJS API + Vite Remix web + Caddy reverse-proxy).
Stack: Drizzle ORM + Postgres, Jest (api), Vitest + Playwright (web), Tailwind, shared
workspace packages under `@repo/*`.

Before committing, run the feedback loops from the repo root:

- `pnpm lint-tsc-api` — `tsc --noEmit` + ESLint for the api workspace
- `pnpm lint-tsc-web` — `tsc --noEmit` + ESLint for the web workspace
- `pnpm lint` — run ESLint across all workspaces via Turbo
- `pnpm test:api` — run api Jest unit tests (fast; use this for iteration)
- `pnpm test:web` — run web Vitest unit tests
- `pnpm test:api:e2e` / `pnpm test:web:e2e` — run e2e suites (slower, run before commit)
- `pnpm format:check` — verify Prettier formatting

Per-workspace when scoping:

- `pnpm --filter api <script>`
- `pnpm --filter web <script>`
- `pnpm --filter @repo/shared <script>`
- `pnpm --filter @repo/email-templates <script>`
- `pnpm --filter @repo/prompts <script>`

DB workflow (Drizzle, run from repo root):

- `pnpm db:generate` — generate migration from schema
- `pnpm db:migrate` — apply pending migrations
- `pnpm db:seed` — seed dev data

# Update progress.md file

**MANDATORY: You MUST update `GS_MAIN/CURRENT-WORK/progress.md` every
single iteration before committing. This is non-negotiable.**

Do NOT skip this step. Do NOT assume a previous iteration already updated
it. Do NOT commit without editing `progress.md` in the same change set.

Append a new entry for THIS iteration (do not overwrite prior entries):

1. Mark the given issue as DONE
2. Include key decisions made
3. Include files changed
4. Blockers or notes for next iteration

Verification before commit:

- `git diff --name-only` MUST include `CURRENT-WORK/progress.md`.
- If it does not, stop and update `progress.md` before proceeding.

# COMMIT

Make a git commit. The commit title should match
the repo convention.
The commit description must contain,
the same information as the progress file.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
