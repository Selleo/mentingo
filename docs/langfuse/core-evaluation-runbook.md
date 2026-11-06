# Running Core AI tests and experiments

All commands run from the repository root on the evaluation PR branch, using the repository's Node 22.15+ and pnpm environment. Normal dependencies/shared packages must already be installed/built. This runbook adds no workflow, webhook, schedule or remote execution. See the [matrix](core-test-case-matrix.md) for which cases each runner owns.

## Package commands for local use

| Command                           | Purpose                                                                             | Running services / credentials                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:ai:regression`         | Run 131 deterministic evaluation harness tests and 16 configuration/recording tests | Node/pnpm dependencies and Python 3; no launched Core/Luma, model keys or Langfuse                                                       |
| `pnpm eval:ai --mode list`        | List available feature datasets and case counts                                     | No services or credentials                                                                                                               |
| `pnpm eval:ai --mode prepare ...` | Prepare selected prompt/application tasks offline                                   | Pinned prompt snapshot or explicit local prompt source; no providers                                                                     |
| `pnpm eval:ai --mode run ...`     | Explicitly execute selected model/application cases                                 | Model cases: provider config/key. Native cases: running local Core, supporting services/workers, disposable fixtures and cookie env vars |
| `pnpm eval:ai:record ...`         | Normalize a real report locally; add `--apply` to upload                            | Dry run needs no services. Upload needs Core Langfuse keys and Python OTLP dependencies                                                  |

`AGENTS.md` requires the first command after meaningful AI changes, plus the narrowest affected product tests. Model/application runs remain explicit via case selection and runner flags, respecting task restrictions. Langfuse uploads are not part of the default regression command.

These are package aliases for the existing tested runners, not another implementation. They do not start services, migrate databases, seed fixtures, log in, copy dotenv secrets or create/modify Langfuse configuration. Use absolute configuration/report paths; `eval:ai` executes inside `apps/api`, whereas `eval:ai:record` executes at the repository root. Missing services/fixtures produce failed/not-run results, never a simulated pass.

For native application experiments, launch the local test environment with the repository's normal setup/dev recipe first, including database/Redis/storage/workers required by the selected flow. The local Core application's configuration determines whether Luma itself is local or a hosted test endpoint. A hosted Luma API key alone does not supply Core's database, authenticated users, fresh threads/courses or workers. The experiment command remains loopback-only for Core and requires explicitly disposable fixtures. Prompt-only evaluations need no running Core/Luma app.

## 1. Run ordinary deterministic checks

No model or Langfuse credentials are required:

```sh
pnpm test:ai:regression
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode validate
mkdir -p /tmp/core-evals
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode offline --out /tmp/core-evals/grading.json
```

`validate` checks the 54 underlying regression definitions and semantic registry. `offline` executes the 12 production grading cases, not all application cases or the 103 feature items.

Voice code is also tested normally. For example:

```sh
pnpm --filter=api test --runInBand src/ai/utils/voice-delivery.spec.ts src/ai/utils/__tests__/voiceControlTags.spec.ts src/ai/services/ai-voice-stream.spec.ts src/audio/external-audio.service.spec.ts
pnpm --filter=web test app/modules/Voice/voiceSocketProtocol.test.ts app/modules/Voice/hooks/voiceMentorSocketHandlers.test.ts
```

These are controlled tests, not real recognition or listening checks. The matrix links more existing audio/capture/recovery specs. The commands are inventory guidance; only commands listed in the matrix's validation record were rerun for this documentation change.

## 2. Run the normal Core–Luma application contract tests

Use the existing E2E environment with disposable test database, migrations and required service configuration. These specs use controlled Luma transport; they do not measure course-generation quality or need Langfuse:

```sh
NODE_OPTIONS=--experimental-vm-modules pnpm --filter=api test:e2e --runInBand --testPathPattern='course-authoring-(http-roundtrip|native-apply)\.e2e-spec\.ts'
```

These tests cover HTTP request/proposal/application receipts, native persistence, rollback and retry deduplication. Do not point test configuration at production. This command was not executed for the documentation update.

## 3. List or prepare feature experiments offline

```sh
pnpm eval:ai --mode list
pnpm eval:ai --mode prepare --feature mentor-teacher-chat --prompt-source local --out /tmp/core-evals/teacher-prepared.json
```

Local source is explicitly nonproduction. For comparison against managed production prompts, replace `--prompt-source local` with `--prompt-snapshots /tmp/core-evals/production-prompts.json`. Supply all required fragments in the [documented snapshot format](core-ai-feature-coverage.md#prepare-without-provider-or-application-calls). Snapshots pin prompt names, versions and hashes. Preparation performs no model, application or Langfuse requests; it cannot pass a quality case.

## 4. Explicitly run a model response case

Create `/tmp/core-evals/provider.json` with nonsecret configuration:

```json
{ "model": "YOUR_EXPLICIT_MODEL", "apiKeyEnv": "EVAL_FEATURE_API_KEY", "timeoutMs": 60000 }
```

Set that named credential through normal secret tooling; it is not read from dotenv. Optional `baseURL` must be HTTPS. The provider must support the selected production output schema. Embeddings require a separate embedding model configuration.

```sh
pnpm eval:ai --mode run --feature mentor-teacher-chat --case mentor-teacher-chat-grounded-v1 --prompt-snapshots /tmp/core-evals/production-prompts.json --provider-config /tmp/core-evals/provider.json --allow-model-requests --out /tmp/core-evals/teacher-result.json
```

This calls the model. It does not start the native Mentor application, save a conversation, or upload to Langfuse. Exit 2 means output exists but quality review is pending, not a transport failure. Omit the opt-in flag and no model is invoked; missing prerequisites fail or remain not run.

## 5. Explicitly run a native application case

Provision a local disposable Core/Luma environment with workers and owned fixtures. The runner does not seed fixtures. Use an app config matching [the feature fixture contract](core-ai-feature-coverage.md#run-native-application-tasks-with-disposable-fixtures): loopback base URL, `disposableTenant: true`, fresh isolated resources, cookies referenced only by environment-variable name, and fixtures keyed by feature item ID. Authoring needs `allowAuthoringWrites: true` and a distinct disposable course per case.

```sh
pnpm eval:ai --mode run --feature core-luma-authoring-apply --case core-luma-authoring-apply-grounded-v1 --prompt-source local --app-config /tmp/core-evals/app-fixtures.json --allow-app-requests --out /tmp/core-evals/apply-result.json
```

This can call Luma's configured provider and write to the disposable course. For proposal-only checking select `core-luma-authoring-proposal` and its item ID instead. The stale-edit adversarial apply case remains `not_run`: no concurrent-edit driver is implemented.

For actual transcription, select `mentor-transcription` and supply a synthetic 16 kHz mono PCM fixture, expected script and matching SHA256 as documented. The same flag enables authenticated socket calls. No microphone is captured; a transcript is not proof of playback or voice quality.

## 6. Record actual results in Langfuse

First run the model/application and retain its real report. Then upload it separately. Python needs the OpenTelemetry SDK and OTLP HTTP exporter (the existing Luma API environment has these dependencies). Set `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` for the verified Core project through normal secret tooling. The recorder verifies the setup project ID; it never runs the model/application or creates model connections.

Dry-run report normalization, without network calls:

```sh
pnpm eval:ai:record --report /tmp/core-evals/teacher-result.json --run-name teacher-baseline-v1 --receipt /tmp/core-evals/record-preview.json
```

Explicit remote upload:

```sh
pnpm eval:ai:record --report /tmp/core-evals/teacher-result.json --run-name teacher-baseline-v1 --receipt /tmp/core-evals/record-receipt.json --apply
```

Prepared/reference data cannot be submitted as successful execution. Use a new run name for an intended new capture; do not re-upload identical spans to update them. Recording duration is ingestion time, not model latency. Existing per-dataset Langfuse rules evaluate new submitted experiment items asynchronously. Their scores do not override failed deterministic workflow checks.

## 7. Compare a prompt change and calibrate the judge

Repeat the same cases with the new pinned prompt snapshot, same fixture/source/model configuration and a new run name such as `teacher-candidate-v2`. In the [Core Langfuse project](https://cloud.langfuse.com/project/cmiitc20o00qtad07rwd8bx29), inspect the dataset's experiment runs, actual responses, invariant checks, expected outputs and evaluator scores. Record failures, missing evidence, skipped cases and provider errors separately from passes. Do not compare a prompt-only run with an application run as if they proved the same behavior.

Core hosted judges use `gpt-6-luna`. For comparable local judging, explicitly set that model in the judge configuration; this does not change the application model under test. See [exact checks](core-evaluator-checks.md).

The separate local semantic judge supports captured legacy application reports and calibration. It does not consume arbitrary prepared feature JSON. After making an explicit judge config with `model`, `apiKeyEnv` and optional HTTPS `baseURL`:

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode calibrate --judge-config /tmp/core-evals/judge.json --allow-judge-requests --out /tmp/core-evals/calibration.json
```

This calls the judge on 16 labeled candidates across eight scenarios, not the application. See [local semantic evaluation](regression-evaluations.md#llm-evaluators-and-calibration-later) for `--mode http` and `--mode evaluate` captures. Labels need independent domain review; a calibration run was not executed during setup.

## Can Langfuse trigger these directly?

| Action                                                         | Available in this setup?                                                 | What executes                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Run ordinary Jest/Vitest/E2E checks                            | Yes, terminal/existing repository CI                                     | Test code; no Langfuse required                                          |
| Run the complete feature/application runner                    | Yes, explicit CLI commands above                                         | Your local application/model environment                                 |
| View/compare uploaded experiments and their scores in Langfuse | Yes, after actual reports are uploaded                                   | Existing evaluator rules score submitted items                           |
| Trigger a prompt/model-only experiment from Langfuse UI        | Langfuse product capability; no Core UI experiment preset was configured | Prompt/model generation; not Core auth, persistence, sockets or tools    |
| Click in Langfuse to run this Core CLI against an application  | Not configured                                                           | Requires a deployed external worker/service and configured webhook       |
| Automatically run a dataset after a prompt changes             | Not configured                                                           | Requires an explicit CI/webhook policy and suitable runtime fixtures     |
| Automatically judge new application traces                     | Configured separately in the published setup                             | Scores matching captured observations; does not execute regression cases |

Langfuse supports [UI prompt experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-ui) and [UI webhook triggers for external SDK experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk#configure-webhook). Current full application execution is CLI-based. A future UI trigger would need a deployed authenticated job receiver, disposable fixture provisioning, bounded execution and result export; that service has not been added. Enabling evaluators does not create it.

## Result meanings

`prepared`: offline setup only. `needs_review`: output captured and available checks ran; semantic quality remains pending. `failed`: a concrete check/transport failed. `not_run`: missing prerequisites or unsupported adapter. Langfuse judges use `pass`, `fail`, `insufficient_evidence`; the code score `present` only indicates captured output. Report selection/denominators, not just averages. A pass from one layer cannot establish a different layer's outcome.
