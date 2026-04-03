# Setup, Fixtures, Factories, Flows

## Setup Files

### `env.setup.ts`

- validate required env vars
- fail fast if env is incomplete
- expose deterministic `runId`

### `db.setup.ts`

- start infra
- run migrations
- run minimal baseline seed

### `auth.setup.ts`

- prepare auth states once
- reuse auth states in tests
- produce:
  - one shared readonly storage state
  - one writer storage state per Playwright worker

## Account/State Model (Important)

- Read-only flows use one shared readonly account/state.
- Mutating flows use worker-isolated writer accounts/states.
- Do not run write flows against shared readonly state.
- Do not mix readonly and writer state in the same test file.

Recommended storage files:

- `.auth/readonly.json`
- `.auth/writer-worker-0.json`
- `.auth/writer-worker-1.json`
- `.auth/writer-worker-N.json`

How to generate writer states:

- during `auth.setup.ts`, iterate worker indexes and log in writer accounts for each worker
- persist deterministic mapping: `workerIndex -> writer state path`

## Fixture Model

### `api.fixture.ts`

Provides API client used only for setup/cleanup/preconditions.

### `data.fixture.ts`

Provides scenario data builders (`createCourseWorld`, etc.).

### `cleanup.fixture.ts`

Registers cleanup tasks and executes them after each test.

### `page.fixture.ts`

Provides page/context defaults and state selection:

- `withReadonlyPage` for read-only scenarios
- `withWriterPage` for mutating scenarios

### `expectations.fixture.ts`

Loads reusable expected values.

### `test.fixture.ts`

Composes all fixtures and exports custom `test`.

## Factory Model

- `core`: context + cleanup registry
- `primitives`: create one entity
- `composites`: create connected entities
- `scenarios`: ready-to-use test worlds

Deterministic naming:

- `entity-<runId>-w<worker>-t<test>-n<seq>`

## Flow Model

Use function modules, not class-heavy orchestration.

Examples:

- `course.flow.ts` for course edit actions
- `enrollment.flow.ts` for enrollment actions

## Why This Works

- no cross-test dependency
- clean setup/cleanup boundaries
- easier debugging and reuse
