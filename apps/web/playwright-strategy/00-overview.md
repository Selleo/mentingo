# E2E Approach (TOC)

## Goal

Build a new E2E suite with:

- capability-based specs
- functional flow helpers
- fixture-driven setup and cleanup
- deterministic test data
- cross-browser stability

## How to Read This

1. Start with [01-structure-and-style.md](./01-structure-and-style.md)
2. Then read [02-setup-fixtures-factories-flows.md](./02-setup-fixtures-factories-flows.md)
3. Use [03-capability-coverage.md](./03-capability-coverage.md) as execution checklist
4. Use [04-tags-and-execution-policy.md](./04-tags-and-execution-policy.md) for CI and tagging rules
5. Use [05-account-state-and-config.md](./05-account-state-and-config.md) for shared-readonly and per-worker-write setup

## Key Decisions

- Structure is guidance, not rigid contract.
- API usage in tests is fixture-only (setup/cleanup/preconditions).
- Avoid class-heavy test code; prefer functional flows.
- Keep selectors deterministic (`data-testid` conventions).
- Full-depth coverage for each capability.
- Account model is explicit: one shared readonly identity + one writer identity per worker.
