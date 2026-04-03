# Tags And Execution Policy

## Core Tags

- `@smoke`: smallest fast confidence set
- `@core`: critical regression set on PRs
- `@full`: full-depth capability coverage

## Execution Tags

- `@slow`: long-running flows
- `@serial`: only if unavoidable
- `@i18n`: copy/translation assertions

## Domain Tags (one per spec)

`@auth @navigation @courses @lessons @enrollments @users @groups @categories @announcements @qa @news @articles @settings @env @certificates @promotions @statistics @tenants @onboarding @support-mode @voice @stripe`

## CI Plan

### PR

- run `@smoke` + `@core`
- run on Chromium + Firefox
- run read-only and write shards separately

### Nightly/Main

- run `@full`
- include `@slow`

## Timeouts (budgets, not sleeps)

- test: `90s`
- expect: `10s`
- action: `15s`
- navigation: `30s`

## Retries (CI)

- `@smoke`: 0
- `@core`: 1
- `@full`: 1
- `@slow`: up to 2 when needed

## Auth State Strategy

- one shared read-only account for read-only flows
- one writer account per worker for mutating flows
- map writer account by worker index to keep write tests parallel-safe
- keep separate storage-state files for readonly vs writer workers

## `getByText` Policy

- allowed
- warning-only rule in non-`@i18n`: add a short comment for intentional use

## Coverage Depth

- full depth per capability:
  - happy path
  - validation path
  - critical edge/error path
  - state transition path
