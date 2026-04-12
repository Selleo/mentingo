# Refactor Flow Example

## Purpose

This file describes the order we should follow when migrating or redesigning a Playwright flow.

The goal is to keep the change small, deterministic, and easy to review:

1. update the Playwright config shape
2. set up fixtures
3. set up test data
4. write flows
5. write specs per flow

## Recommended Order

### 1. Update Config

Make the test runner aware of the new structure before moving test logic.

Typical config changes:

- add or rename projects
- split read-only and mutating execution paths
- wire setup projects and dependencies
- define tags or grep rules for the suite
- keep timeouts and retries explicit

Do not mix this step with test logic changes.

### 2. Set Up Fixtures

Create small fixtures that expose dependencies instead of embedding setup in specs.

Common fixture layers:

- `api` for setup and cleanup only
- `page` for page/context defaults
- `data` for scenario builders
- `cleanup` for teardown registration
- `expectations` for reusable assertions
- `test` for the final composed export

Rule of thumb:

- specs should not know how the data was created
- flows should not know how assertions are organized

### 3. Set Up Data

Move all predictable inputs into data builders and scenario objects.

Use three tiers:

- primitives: one entity
- composites: connected entities
- scenarios: ready-to-use worlds for tests

Keep expected values separate from setup data when they are reused across tests.

### 4. Write Flows

Put interaction sequences in flow modules, not in specs.

Examples:

- `course.flow.ts`
- `enrollment.flow.ts`
- `profile.flow.ts`

Flow modules should:

- perform the UI steps for one business action
- return useful identifiers or state when needed
- stay reusable across multiple specs

### 5. Write Specs Per Flow

Specs should be short and capability-focused.

Recommended spec shape:

- arrange with fixtures and scenario data
- call one flow or one clear interaction path
- assert the expected outcome

Avoid stuffing multiple unrelated capabilities into one file.

## Example Migration Path

If you are refactoring an existing spec, move it in this order:

1. extract the data it depends on into a scenario file
2. extract the repeated user actions into a flow file
3. compose the needed fixtures
4. rewrite the spec to use fixtures + flow + scenario
5. split the file if it covers more than one capability

## Example File Layout

```txt
playwright-strategy/
  fixtures/
  data/
    scenarios/
    expected/
  flows/
  specs/
```

## Review Check

Before merging a migrated flow, confirm:

- config points to the right project and state
- fixtures are composed once and reused
- data is deterministic
- the flow is reusable
- the spec covers one capability only
