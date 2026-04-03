# Account State And Config

## Account Model

- Shared readonly account/state for non-mutating flows.
- One writer account/state per worker for mutating flows.

Why:

- readonly tests are cheap and parallel-safe
- write tests avoid state collisions by worker isolation

## State Files

- `e2e/.auth/readonly.json`
- `e2e/.auth/writer-worker-0.json`
- `e2e/.auth/writer-worker-1.json`
- ... one per worker

## Setup Behavior (`auth.setup.ts`)

1. login readonly account and save `readonly.json`
2. for each worker index, login writer account and save `writer-worker-{index}.json`

## Playwright Project Pattern

- readonly projects use `readonly.json`
- write projects use `writer-worker-{parallelIndex}.json` selected in fixture/runtime

## Fixture Pattern

- `withReadonlyPage()` -> new context with readonly storage state
- `withWriterPage()` -> new context with writer storage state mapped to current worker

## Practical Rule

- If a spec mutates backend state, it must use writer state.
- If a spec only reads, prefer readonly state.
