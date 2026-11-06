# Core AI regression tests

```sh
pnpm test:ai:regression
```

Run this after meaningful AI changes, as required by `AGENTS.md`. It checks the deterministic evaluation harness and recording/configuration code without a running app or model credentials. Also run affected product tests.

- [Runbook](core-evaluation-runbook.md): local prerequisites, package commands, fixture configuration and optional Langfuse recording.
- [Case matrix](core-test-case-matrix.md): scenarios, expected outcomes, execution layers and coverage gaps.
- [Exact checks](core-evaluator-checks.md): code assertions and LLM judging rubrics.
- [Regression history](regression-history.md): the incidents behind the cases.
- [Langfuse configuration](remote-evaluation-setup.md): maintain evaluator/rule configuration using the shared scripts.

Normal tests own voice/socket behavior, grading arithmetic, permissions and persistence. Optional model/provider runs assess generated meaning, grounding and recognition accuracy. Langfuse records and compares those runs; it is not required for normal tests.

Luma owns course-generation quality. Core's authoring cases check its integration boundary: scoped proposals, application receipts, saved changes and unchanged unrelated content.

Run results belong in reports. Preparing a case does not establish a model pass; a nonempty reply does not establish semantic correctness. The matrix lists duplicate inputs, unsupported cases and other limits.
