# Core AI tests and evaluations

Start here to decide what to run and how to interpret the result. These documents describe Core PR #2105; they are not a claim that every dataset has passed against a live model.

- [Coverage and individual case matrix](core-test-case-matrix.md): every feature, all 103 feature items, the 54 underlying regression cases and 16 evaluator calibration candidates. Execution evidence and gaps are explicit.
- [Exact checks](core-evaluator-checks.md): hosted LLM rubrics, executable assertions, local evidence validation and explicit limits.
- [Runbook](core-evaluation-runbook.md): copyable commands, prerequisites, local versus remote effects and Langfuse trigger behavior.
- [Feature implementation details](core-ai-feature-coverage.md): adapters, prompt snapshots, source paths and fixture configuration.
- [Historical regressions](regression-history.md): issue-to-expectation mapping.
- [Published configuration](published-setup.md): Langfuse project, evaluator/rule IDs and setup snapshot.

## Local package entry points

Run `pnpm test:ai:regression` after meaningful AI changes, as required by `AGENTS.md`. It runs the deterministic checks without a launched application or provider/Langfuse credentials. Use `pnpm eval:ai --mode list` for experiment selection; actual execution needs the explicit run mode, opt-in flags and supplied config. `pnpm eval:ai:record` normalizes a captured report, with remote upload only when `--apply` is supplied. See the [local runbook](core-evaluation-runbook.md#package-commands-for-local-use) for prerequisites and examples.

## Which layer owns the check?

| Layer                              | Responsibility                                                                                                                                                    | Execution                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Normal unit/component tests        | Deterministic code: socket events, audio framing, cancellation, display markup, source filtering, score arithmetic, schema validation, retries and error handling | Jest/Vitest, controlled transports/providers; no Langfuse required                     |
| Normal integration/E2E tests       | Authentication, owned resources, persistence, transaction rollback, receipts, deduplication and application integration                                           | Isolated test services/database, controlled model/Luma responses; no Langfuse required |
| Optional model/provider evaluation | Recognition accuracy, generated response meaning, grounding, translation fidelity, prompt behavior and embedding relevance                                        | Explicit model/application runner; may call providers                                  |
| Experiment tracking                | Compare the same cases across prompt/model/application revisions                                                                                                  | Upload actual captured results to Langfuse; tracking is optional for executing a test  |
| Online monitoring                  | Inspect new instrumented application output after it happens                                                                                                      | Langfuse evaluator rules; does not execute test cases                                  |

An evaluation is a check, not a separate kind of test framework. Quality datasets can also be invoked by an explicitly enabled integration test or CI job. Langfuse stores/computes comparisons; it is not needed to test the audio protocol or Core persistence.

## Voice and transcription

Normal tests are the primary protection for voice session startup, PCM format/sample rate, chunk forwarding, final/partial transcript events, stale-session suppression, interruption/cancellation, reconnect behavior and spoken/display markup. Existing test files are linked in the matrix. Their mocks prove code behavior, not what an ASR model heard or a TTS provider sounded like.

The optional `mentor-transcription` experiment sends a supplied synthetic audio fixture through the actual authenticated socket path and captures the transcript. It checks provider-dependent recognition, especially negations and amounts. The three voice prompt datasets inspect generated text and instructions, not audio. There is no implemented listening/perceptual TTS benchmark, physical microphone test or audible-quality pass in this catalogue. A fixed audio corpus could be run as an opt-in integration suite; tracking its results as experiments is optional.

## Core versus Luma authoring

Luma owns generation, planning, research, lesson writing, course review, provider execution and its internal recovery pipeline. Those quality datasets belong in [Luma PR #62](https://github.com/Selleo/mentingo-ai/pull/62), not Core's generation-quality score.

Core owns the integration boundary: tenant/permission checks, session/course binding, submitting the intended request, leaving a proposal unapplied, accepting/applying the intended export, native persistence, receipt identity, rollback and deduplication. Existing Core E2E tests cover those contracts with controlled Luma responses. The two `core-luma-authoring-*` datasets are optional cross-service integration scenarios for that boundary, not a second test of Luma's full course-generation pipeline. A valid receipt cannot establish lesson quality; fluent lesson text cannot establish a saved Core course.

## Current evidence

The feature catalogue contains 31 datasets and 103 entries; three input pairs are identical (translation and the two embedding datasets), so those pairs do not provide additional independent input coverage. The matrix flags them. All 103 entries were prepared offline with pinned snapshots on 2026-11-06. The 12 production grading cases also passed offline on that date. Neither command executed a model or native application.

The local package command `pnpm test:ai:regression` was verified on 2026-11-06: 131 Core evaluation harness tests and 16 Python configuration/recording tests passed. Those verify runner/scorer behavior with controlled evidence. There is no recorded live Core feature experiment result: do not mark the 103 entries as passed. Normal product test presence is shown separately and is not a substitute for a current test run. Reference labels and LLM judges remain uncalibrated, and the stale-baseline concurrent-edit scenario has no driver.
