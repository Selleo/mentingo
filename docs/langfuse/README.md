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

## Real Langfuse dataset experiments

Copy `experiment.mentingo.example.json`, `experiment.luma.example.json` or
`experiment.slackbot.example.json` to a private config. Set absolute repository,
Python and env-file paths. The examples explicitly test bundled repository prompts. Relative paths resolve against that
config's directory. Python must preserve its virtualenv path and have
`python-dotenv`, `opentelemetry-sdk`, and `opentelemetry-exporter-otlp-proto-http`;
Luma/Slackbot also need their repository dependencies. Core uses Node 22 and pnpm.
Set `EVAL_MODEL_API_KEY` in your shell; never put the key in JSON.
To test pinned managed prompts instead, remove `allowBundledPrompts` and set
`promptSnapshots` to an export in the [documented format](core-evaluation-runbook.md#prompt-snapshots).
The selected prompt source is part of the recorded evidence; bundled prompts do not
prove parity with the currently published production prompt.

From **Core**, for any of the three projects:

```sh
pnpm eval:ai:experiment --config /absolute/private/config.json --check
pnpm eval:ai:experiment --config /absolute/private/config.json
```

The first command checks local prerequisites only. The second verifies the published
dataset's project, ownership, input and expected output before calling a model;
runs each selected native scenario once; records real outputs with v4 experiment
attributes; and reads back experiment and observation IDs. Dataset drift stops the
run, rather than silently rewriting the oracle. No automatic paid retries.

Reports, receipt and summary are written privately under `outputDir`. Failed and
blocked cases remain in the report and make the command fail. Exit 0 confirms
execution/recording, **not semantic acceptance**: asynchronous judge scores may
still be pending or not configured. Inspect scores and the rubric before accepting
a prompt change. Luma's model evaluator connection must be configured separately;
this command does not store provider credentials in Langfuse.

Prompt-only scenarios do not need the local application launched. Native Core app
cases require `appConfig` and disposable running services/fixtures. Luma HTTP/media
cases require their documented app/media variables. Six lifecycle/voice Luma cases
still have blocked adapters and are not executable coverage. Slackbot's app runner
uses the real response service with synthetic tool/delivery adapters and sends no
Slack message. This entrypoint does not deploy a Langfuse UI-triggered app runner;
trigger it from the CLI and compare results in Langfuse Datasets/Experiments.
