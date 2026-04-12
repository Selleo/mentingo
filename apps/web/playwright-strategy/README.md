# Playwright Strategy

This directory contains the implementation plan and example code skeleton for the new E2E system.

## Documents

- [00-overview.md](./00-overview.md): TOC + approach summary
- [01-structure-and-style.md](./01-structure-and-style.md): structure and coding style
- [02-setup-fixtures-factories-flows.md](./02-setup-fixtures-factories-flows.md): setup + architecture details
- [03-capability-coverage.md](./03-capability-coverage.md): capability/flow checklist
- [04-tags-and-execution-policy.md](./04-tags-and-execution-policy.md): tags, CI execution, timeouts, retries
- [05-account-state-and-config.md](./05-account-state-and-config.md): shared state and project config notes
- [06-refactor-flow-example.md](./06-refactor-flow-example.md): migration order from config to fixtures to data to flows to specs

## Examples

- `examples/`: minimal, placeholder TypeScript examples
  - fixture composition
  - deterministic factories
  - functional flows
  - scenario + expected data usage in spec
