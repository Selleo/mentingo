# Core AI regression tests

```sh
pnpm test:ai:regression
```

Run this after meaningful AI changes, as required by `AGENTS.md`. It checks the deterministic evaluation harness and recording/configuration code without a running app or model credentials. Also run affected product tests.

- [Runbook](core-evaluation-runbook.md): local prerequisites, package commands, fixture configuration and optional Langfuse recording.
- [Case matrix](core-test-case-matrix.md): scenarios, expected outcomes, execution layers and coverage gaps.
- [Exact checks](core-evaluator-checks.md): code assertions and LLM judging rubrics.
- [Langfuse configuration](remote-evaluation-setup.md): maintain evaluator/rule configuration using this repository's scripts.

Normal tests own voice/socket behavior, grading arithmetic, permissions and persistence. Optional model/provider runs assess generated meaning, grounding and recognition accuracy. Langfuse records and compares those runs; it is not required for normal tests.

Luma owns course-generation quality. Core's authoring cases check its integration boundary: scoped proposals, application receipts, saved changes and unchanged unrelated content.

Run results stay in Langfuse or ignored local reports under `experiment-runs/`; do not commit captures, receipts or run summaries. Preparing a case does not establish a model pass; a nonempty reply does not establish semantic correctness. The matrix lists duplicate inputs, unsupported cases and other limits.

## Real Langfuse dataset experiments

Copy `experiment.mentingo.example.json` to a private config. Set the Core repository,
Python and env-file paths. The example explicitly tests bundled repository prompts.
Relative paths resolve against that config's directory. Python needs `python-dotenv`,
`opentelemetry-sdk`, and `opentelemetry-exporter-otlp-proto-http`.
Core uses Node 22 and pnpm. No sibling repository checkout is required.
Set `EVAL_MODEL_API_KEY` in your shell; never put the key in JSON.
To test pinned managed prompts instead, remove `allowBundledPrompts` and set
`promptSnapshots` to an export in the [documented format](core-evaluation-runbook.md#prompt-snapshots).
The selected prompt source is part of the recorded evidence; bundled prompts do not
prove parity with the currently published production prompt.

From the Core repository:

```sh
pnpm eval:ai:experiment --config /absolute/private/config.json --check
pnpm eval:ai:experiment --config /absolute/private/config.json
```

The first command checks local prerequisites only. The second verifies the published
dataset's project, ownership, input and expected output before calling a model;
runs each selected native scenario once; records real outputs with v4 experiment
attributes; and reads back experiment and observation IDs. Dataset drift stops the
run, rather than silently rewriting the oracle. The coordinator never repeats a
case automatically; native SDK retries and schema repair follow the application
adapter policy.

Reports, receipt and summary are written privately under `outputDir`. Failed and
blocked cases remain in the report and make the command fail. A case that was
not executed remains `not_run`; absence checks cannot turn it into an observed
model failure. Score readback retains the judge reason and target observation. Exit 0 confirms
execution/recording, **not semantic acceptance**: asynchronous judge scores may
still be pending or not configured. Inspect scores and the rubric before accepting
a prompt change. This command does not store provider credentials in Langfuse.

Prompt-only scenarios do not need the local application launched. Native Core app
cases require `appConfig` and disposable running services/fixtures.
The application uses its configured Luma endpoint for integration cases; the runner
requires no access to that service's repository. This entrypoint does not deploy a
Langfuse UI-triggered app runner;
trigger it from the CLI and compare results in Langfuse Datasets/Experiments.

## Candidate prompts and media evidence

For unpublished prompt changes, use `promptSnapshots` with each changed record
marked `"label": "candidate"`; unchanged records retain `"label": "production"`.
Candidate records contain the repository source text and its source version. The
runner records this distinction and does not publish or move Langfuse prompt labels.

To attach actual synthetic PNG/JPEG/WebP, WAV or PDF artifacts, set
`"mediaRoots": ["/absolute/private/synthetic-assets"]` in the experiment config.
Without this explicit allowlist no local artifact is read or uploaded. The recorder
checks paths, MIME signatures, lengths and SHA256 hashes before recording, uploads
only supported artifacts of at most 20 MB, and verifies media metadata. Raw PCM
needs a WAV descriptor with the actual sample rate. An attachment does not establish
image/audio quality: inspect the perceptual rubric, model support and any required
human review. Saved artifact hashes alone cannot prove what an image shows or audio says.

## Require a passing regression result

Add `--require-pass` to execution or receipt verification to fail unless every
selected case executed successfully and has a verified root-bound feature-judge
`pass`. Pending scores, missing evidence, failed checks and unrun cases fail this
gate. It does not retry model generation. Normal recording mode retains its
existing execution-only exit status. Readback allows asynchronous ingestion/judging
to settle; use `--verify-receipt` to check later without generating again.

## Read existing results without executing again

```sh
pnpm eval:ai:experiment --config /absolute/private/config.json --verify-receipt /absolute/private/receipt.json
```

This mode uses Langfuse credentials only; no model key, app, native runner or OTLP
export is required. Loading `envFiles` in this mode requires `python-dotenv` in
the CLI Python; shell-supplied Langfuse credentials work without it. It verifies
the receipt project, exact experiment/root IDs, and feature-judge score bindings,
retaining reasons and missing scores. The readback batches paginated requests;
it does not repeat model calls or upload an experiment. A 63-case real readback
completed in 2.15 seconds during verification. Quality failures remain visible;
readback completion is not a release pass.
