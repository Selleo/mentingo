# E2E Strategy

## Purpose

This document describes how the E2E suite is organized today and how new tests should be added.

It is based on:

- the Playwright strategy notes in `playwright-strategy/`
- the current fixture/setup implementation in `e2e/`
- the decisions made while stabilizing auth, cleanup, and parallel worker execution

This file is the practical source of truth for writing tests in this repo.

## Goals

The suite is designed to:

- keep specs short and business-focused
- isolate mutating tests so they can run in parallel safely
- use API setup/cleanup instead of fragile UI bootstrapping
- keep UI actions reusable through flows
- make failures easier to debug through deterministic structure

## Current Setup Model

The Playwright setup chain is:

1. `db.setup.ts`
2. `auth.setup.ts`
3. browser test projects

### `db.setup.ts`

Responsibilities:

- start local infra when needed
- run migrations
- seed baseline data

### `auth.setup.ts`

Responsibilities:

- log in as admin once
- ensure shared readonly accounts exist
- write readonly storage states

Readonly accounts are created in setup because they are shared and cheap to reuse.

Worker accounts are not created in `auth.setup.ts`.

## Auth State Model

There are two account types:

### Readonly accounts

- shared across tests
- created in `auth.setup.ts`
- storage states live in `e2e/.auth/readonly-<role>.json`

Use readonly accounts for:

- non-mutating flows
- visibility checks
- browsing/assertion flows that do not change backend state

### Worker accounts

- created lazily once per worker
- isolated by Playwright `project.name` and `workerIndex`
- storage states live in `e2e/.auth/worker-<project>-<workerIndex>-<role>.json`

Use worker accounts for:

- mutating flows
- create/update/delete flows
- tests that should not collide across workers or browsers

### Why worker accounts include project name

`chromium` worker `0` and `firefox` worker `0` are different execution lanes.

If they shared the same account/state, cross-browser parallel runs would collide.

So worker identity is keyed by:

- Playwright project name
- worker index
- role

### Isolated workspaces

- opt-in per test or per worker
- create a fresh tenant and enter it through support mode
- return a workspace handle with its own page, API client, factories, and tenant metadata
- in E2E runtime, outbox-driven side effects should publish immediately so setup does not wait on background dispatch

Use isolated workspaces for:

- tests that must prove a change stays within one tenant
- tests that compare tenant-local data against the shared baseline
- scenarios that need a dedicated tenant without changing the rest of the suite

### Worker-owned tenant workspaces

- provision one tenant per Playwright worker
- reuse that tenant for the lifetime of the worker
- create fresh user sessions inside that tenant when a test needs a different role
- prefer this for flows that need stable tenant identity across multiple pages in the same worker

## Fixture Model

The suite uses layered fixtures.

### `api.fixture.ts`

Provides the API client used for:

- setup
- cleanup
- preconditions
- factories

This is not for normal UI assertions inside specs.

### `cleanup.fixture.ts`

Provides:

- `cleanup.add(() => Promise<void>)`

Cleanup tasks run in reverse order after the test body.

Cleanup errors are rethrown with the underlying messages so failures are debuggable.

### `page.fixture.ts`

Provides low-level page/context helpers:

- `withReadonlyPage`
- `withWorkerPage`

These select the correct storage state and create a new browser context for the test run block.

### `factory.fixture.ts`

Provides factories built on top of the shared `apiClient`.

Prefer factories for setup when the test only needs the final entity state.

### `test.fixture.ts`

Composes the final public test surface.

It currently does three important things:

1. composes page, factory, and cleanup fixtures
2. lazily provisions worker accounts once per worker through `_workerAuthReady`
3. syncs browser cookies into the API client inside `withReadonlyPage` and `withWorkerPage`

That cookie sync is what allows factories and cleanup to act as the same authenticated user as the browser context.

## Directory Structure

Current structure:

```txt
e2e/
  .auth/
  data/
    auth/
    categories/
    navigation/
    test-data/
  factories/
  fixtures/
  flows/
    categories/
  specs/
    categories/
  utils/
  auth.setup.ts
  db.setup.ts
  playwright.constants.ts
  strategy.md
```

What each layer means:

- `data/`: constants and static test data
- `factories/`: API-backed entity creation helpers
- `fixtures/`: dependency wiring and auth/session handling
- `flows/`: reusable UI action sequences
- `specs/`: business intent + assertions

## Data Conventions

Keep static values in `e2e/data/`.

Examples:

- selector handles
- static labels
- default test-data prefixes

Current pattern:

- handles live in objects like `LOGIN_PAGE_HANDLES`
- test-data values live in objects like `TEST_DATA`

Do not hardcode repeated values across specs when they can live in a small shared object.

## Factory Conventions

Factories are API-first helpers for deterministic setup.

Current example:

- `CategoryFactory`

Factory rules:

- create entities through API
- expose small, intention-revealing methods
- allow explicit input when the test cares about the value
- provide a sensible default when the test does not care

Example:

```ts
const category = await categoryFactory.create();
const namedCategory = await categoryFactory.create("Original Category");
```

Factories should not embed browser logic.

## Flow Conventions

Flows hold reusable UI interaction sequences.

Current example:

- `flows/categories/update-category.flow.ts`

Flow rules:

- accept plain input data
- perform UI actions only
- do not contain test setup
- do not contain cleanup
- keep assertions in the spec unless the assertion is reusable by many specs

Example split:

- flow: open category page, fill title, click save
- spec: create category, call flow, assert title changed, assert backend state changed

## Spec Conventions

Specs should be short and capability-focused.

A good spec should mostly read like:

1. arrange test data with factories
2. register cleanup
3. open the correct auth page context
4. call a flow or do one clear interaction path
5. assert UI outcome
6. assert backend outcome when relevant

Current example:

- `specs/categories/update-category.spec.ts`

## Practical Rules

### When to use readonly vs worker

- use `withReadonlyPage` for read-only checks
- use `withWorkerPage` for create/update/delete flows

Do not use readonly state in mutating specs.

### Cleanup

- always register cleanup for created entities unless the test intentionally verifies persistence
- prefer cleanup through factories/API, not UI

### Assertions

- UI assertions belong in specs
- backend verification through `expect.poll(...)` is preferred when writes may settle asynchronously

Example:

```ts
await expect
  .poll(async () => {
    const updatedCategory = await categoryFactory.getById(category.id);
    return updatedCategory.title;
  })
  .toBe(updatedTitle);
```

`expect.poll(...).toBe(...)` means Playwright will keep retrying the callback until the value matches or the timeout is reached.

### Parallel Safety

- readonly tests are safe because the account/state is shared but non-mutating
- write tests are safe because worker accounts are isolated by project and worker index

## Timeouts

The current timeout budgets are:

- test: `90s`
- expect: `10s`
- action: `15s`
- navigation: `30s`
- `_workerAuthReady` worker fixture: `90s`

These are budgets, not excuses to add sleeps.

## Capability Ownership

Based on `playwright-strategy/03-capability-coverage.md`:

### Its-Gabo

- Auth -- DONE
  - login success/failure
  - register
  - password recovery/reset
  - magic-link
  - MFA
  - logout
- Navigation -- DONE
  - public visibility
  - authenticated visibility
  - manage/super-admin visibility
  - invalid-route redirects
- Learning -- DONE
  - lesson open
  - next lesson progression
  - mark complete
  - sequence enforcement
  - quiz submit/retake
  - AI mentor interaction entry
  - blocked/unblocked access
- Announcements -- DONE
  - create/list
  - unread count
  - mark read
  - feed visibility
- News -- DONE
  - list/open/create/update/delete
  - draft/preview
  - language variant add/delete
  - resource upload
- Articles -- DONE
  - list/open/create/update/delete
  - sections + section languages
  - preview
  - TOC
- Settings
  - user settings
  - org/company info
  - branding assets
  - login page files
  - registration form
  - global toggles
  - MFA-related settings
  - default currency
  - feature toggles
- Certificates
  - view/download/share link/share render
- Onboarding -- SKIP
  - progression/completion/reset
- Support Mode -- DONE
  - entry/exit
  - visibility/badge behavior
- i18n -- DONE
  - language switch
  - localized navigation
  - localized validation/copy
  - business tests remain locale-independent

### Japrolol

- Courses -- DONE
  - browse list
  - open details
  - create/update
  - update pricing
  - update status
  - toggle student mode
  - toggle certificate
  - archive/delete
  - delete many
  - transfer ownership
  - language add/remove
- Curriculum -- DONE
  - generate missing translations
  - chapter create/update/delete/reorder/freemium
  - lesson create/update/delete/reorder
  - lesson types: content/quiz/AI mentor/embed
  - resource upload
  - initialize lesson context
- Enrollment -- DONE
  - self-enroll
  - bulk user enroll
  - bulk group enroll
  - group unenroll
  - enrolled users/groups verification
- Users -- DONE
  - create/update/archive
  - bulk archive/delete
  - bulk assign groups/update attributes
  - import users
- Groups -- DONE
  - create/edit/delete
  - bulk delete
  - membership assignment/verification
- Categories -- DONE
  - create/update/delete/delete-many
  - list/search
- QA -- DONE
  - list/open/create/update/delete
  - language variant create/update/delete
- Environment -- DONE
  - env values load
  - env toggles update
  - frontend env availability checks
- Statistics
  - learner progress
  - admin analytics
  - course stats widgets
  - learning time
  - quiz results
- Tenants -- DONE
  - list/create/edit
- Voice / AI
  - voice entry points
  - AI chat/thread entry points
  - AI course generation availability check

### Skipped For Now

- Promotion Codes
- Stripe / Payments

## How To Add A New Test

Use this order:

1. add or reuse selector handles in `e2e/data/...`
2. add or reuse static test-data in `e2e/data/test-data/...`
3. add or extend a factory if the test needs API setup
4. add a flow if the UI interaction is reusable
5. write the spec using `fixtures/test.fixture`

Checklist for a mutating spec:

1. use `withWorkerPage`
2. create test data with a factory
3. register cleanup
4. call a flow or one clear UI sequence
5. assert UI result
6. assert backend result if appropriate

Checklist for a readonly spec:

1. use `withReadonlyPage`
2. avoid backend mutations
3. assert UI behavior only unless backend reads are needed for verification

## What We Are Explicitly Not Doing

At the moment we are not investing heavily in:

- a large tag system or tag-driven config complexity
- `env.setup.ts`
- over-abstracted naming systems with run/test metadata

Those may be added later if the suite grows enough to justify them.

## Summary

The current model is:

- shared readonly auth in setup
- lazy worker auth per worker
- factories for API setup/cleanup
- flows for reusable UI actions
- short specs with business assertions

That is the baseline every new E2E test should follow.
