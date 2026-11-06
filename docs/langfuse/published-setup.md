# Published regression configuration

For test ownership, ordinary voice/integration tests, per-case execution status and exact trigger commands, start with the [testing guide](README.md), [case matrix](core-test-case-matrix.md) and [runbook](core-evaluation-runbook.md).

Project: [mentingo](https://cloud.langfuse.com/project/cmiitc20o00qtad07rwd8bx29). Published on 2026-11-03. Machine-readable IDs, filters, assignments and hashes: [remote-setup.json](remote-setup.json).

31 datasets / 103 synthetic items / 35 evaluators / 34 rules. See [core-ai-feature-coverage.md](core-ai-feature-coverage.md) for feature-by-feature scope and execution prerequisites.

[Shared configuration and recording instructions](https://github.com/Selleo/mentingo/blob/jh_feat_ai_regression_evaluations/docs/langfuse/remote-evaluation-setup.md) explain manual experiment triggers, every-new-trace monitoring, score meanings, comparison and rollback.

Online judges and experiment scoring are enabled using the already-stored `openai` connection with `gpt-4.1-mini`. Root and known nested operation rules sample 100% of new matching observations. This is asynchronous monitoring, not a request blocker.

No Core live model or deployed application experiment was run during this configuration step. Offline case preparation and local tests do not prove full runtime behavior.
