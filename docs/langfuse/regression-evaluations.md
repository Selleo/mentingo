# AI regression evaluations

This is the cross-repository evaluation policy for Mentingo Core, Luma
(`mentingo-ai`) and the Slackbot (`mentingo-plugins`). The first datasets are
synthetic candidate benchmarks. Passing their deterministic checks does not
establish model quality, production delivery, grading validity or audible voice
quality. No remote Langfuse dataset, prompt, evaluator or experiment needs to be
created to run the offline checks. The companion
[history-to-regression map](regression-history.md) explains which past failures
the incident datasets reconstruct and what evidence is required to detect them.

LLM-as-a-judge evaluators are separate opt-in execution paths. They analyze
captured output and return structured dimension verdicts with evidence anchors.
Deterministic application failures still block acceptance. The ordinary offline
commands below do not invoke those providers. Evaluator calibration on paired
synthetic examples is reported separately from regression results for actual
application outputs.

## Core commands

Use the repository's Node 22.15+ environment. From the repository root:

```sh
pnpm --filter=api test --runInBand test/evaluations
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode validate
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode offline --out /tmp/core-evals.json
```

The versioned catalogue is
[`dataset.v1.json`](../../apps/api/test/evaluations/dataset.v1.json). Offline mode
executes 12 production grading calculations. The catalogue also contains seven
search cases, four multi-turn Mentor cases and one title-only Core–Luma application
case for the opt-in HTTP adapter. Ten further scenarios define expectations and
required evidence but have no execution adapter yet. Validation checks catalogue
structure; it does not execute those application flows. Jest checks the scorers
with deliberately wrong results as well as the grading cases.

An additional [`assessment-cases.v1.json`](../../apps/api/test/evaluations/assessment-cases.v1.json)
contains 20 PL/EN cases for the actual assessment workflow from
[#2018](https://github.com/Selleo/mentingo/pull/2018) and
[#2019](https://github.com/Selleo/mentingo/issues/2019). The combined catalogue has
54 cases. These minimal pairs cover own-account versus client activity,
denial/admission, speaker attribution, quotation, hypothetical/ambiguous action,
mixed statements and multiple blockers. Expected verified blocker sets and
pass/fail labels are independent of any evaluator model.

Exit code 0 means every selected executable contract passed, 1 means failure or
an unsupported case, and 2 means transport checks passed but semantic review is
still pending. Reports include the selection and full catalogue count, dataset
hash, runner commit and separate statuses. An offline pass covers grading only.

For a later HTTP run, use an isolated local deployment with workers, test content
and remote telemetry disabled. The adapter accepts only a loopback HTTP base URL,
requires `disposableTenant=true`, consumes explicitly named cookie environment
variables, and does not load `.env`. It does not create/reset fixtures: prepare
the actors/content described by each case's `input.fixtureRequirements` through
existing test factories. Use distinct fresh threads/courses per case and reset
them before a second run. Put configuration and reports outside tracked files.

Example `/tmp/core-eval-fixtures.json`, after replacing ID placeholders with
provisioned fixture IDs:

```json
{
  "baseUrl": "http://127.0.0.1:3000/api",
  "disposableTenant": true,
  "fixtures": {
    "search-keyword-title": {
      "isolated": true,
      "cookieEnv": "EVAL_SEARCH_COOKIE",
      "expectedResultIds": ["<seeded-readable-id>"],
      "forbiddenResultIds": ["<seeded-hidden-id>"]
    },
    "mentor-teacher-multi-turn": {
      "isolated": true,
      "cookieEnv": "EVAL_MENTOR_COOKIE",
      "threadId": "<fresh-owned-thread-id>"
    }
  }
}
```

After provisioning fixtures, the explicit HTTP command is:

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode http --allow-app-requests --config /tmp/core-eval-fixtures.json --case mentor-teacher-multi-turn --out /tmp/core-http-evals.json
```

Authoring additionally requires `allowAuthoringWrites=true` and a fixture with
`courseId` for `authoring-title-only-native-roundtrip`. It accepts and applies a
proposal to that disposable course. The adapter checks the final receipt,
operation identities and native context readback. The scoped roundtrip does not
prove full-course generation, revision-conflict recovery or media fidelity.
Search checks membership/access and explicitly empty results, not rank quality.
An unready semantic index is a failed precondition, not a valid hybrid baseline.

Luma's commands and coverage matrix live in its `docs/evaluations/README.md`.
Slackbot's commands and evidence format live in `apps/slack-bot/evals/README.md`
in `mentingo-plugins`. Both run independently without remote Langfuse execution.

## Actual assessment workflow, later

For an assessment fixture, seed the exact transcript and rubric from the case,
using a new active owned thread per case. Its fixture entry needs `threadId`,
`lessonId`, `blockingErrorIds` mapping both `B1` and `B2` to their persisted UUIDs,
and the learner's `cookieEnv`. Set `rubricCookieEnv` to an independently authorized
author/admin cookie variable if the learner cannot read the hidden rubric. This
does not expand the learner's permissions.

The adapter reads the active thread and native localized rubric, verifies every
configured blocker mapping and the exact transcript, then calls
`POST /ai/judge/:threadId`. That invokes Core's production assessment and
independent blocker-verification orchestration. It compares the final blocker
identities/pass flag and reads back the completed owned thread. A direct call to
Luma's generic Judge generation is a different operation. The fixture has no
scored criteria so these cases isolate blocker semantics from scoring attainment.

After fixture provisioning, select one case explicitly:

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode http --allow-app-requests --config /tmp/core-eval-fixtures.json --case assessment-2019-own-account-en --out /tmp/core-assessment.json
```

This command can invoke the configured application model. It is not part of the
offline checks and was not executed during this PR. The endpoint response and
thread readback do not by themselves expose every internal model/verifier span;
retain normal application tracing separately when inspecting those details.

## LLM evaluators and calibration, later

[`semantic-cases.v1.json`](../../apps/api/test/evaluations/semantic-cases.v1.json)
contains eight semantic scenarios and 16 contrasting candidate outputs with
concrete source facts and history links. Five scenarios map to captured Mentor
and title-only authoring output. Three additional scenarios test the evaluator
against historical false blockers, attachment provenance and falsely reported
application success. They are calibration examples, not extra application runs.

The evaluator separately judges source grounding, task fulfillment, role/language
and safe behavior where applicable. It requires concise reasons and exact quotes
from candidate output; grounding also needs an independent source quote. Code
validates dimensions, quotes and shape, and derives the result. Captured workflow
checks contribute a separate deterministic dimension: a failed application check
cannot become successful because of model approval or missing judge output.
Effective evaluator prompt, evidence, dataset/capture and model configuration
hashes are recorded. Provider bodies and credentials are not printed.

Prepare an explicit local judge config and set its API key variable in the shell:

```json
{
  "model": "<explicit evaluator model>",
  "apiKeyEnv": "EVAL_JUDGE_API_KEY",
  "timeoutMs": 60000
}
```

The default provider endpoint is OpenAI; an explicit HTTPS `baseURL` can select
another compatible endpoint. No model is chosen automatically. Requests disable
telemetry and provider storage. These commands invoke a model only after the
explicit flag; neither was run during this PR:

```sh
# Analyze an actual HTTP capture; does not rerun the app.
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode evaluate --capture /tmp/core-http-evals.json --judge-config /tmp/core-judge.json --allow-judge-requests --out /tmp/core-semantic.json

# Measure judge agreement on paired synthetic outputs; does not run the app.
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode calibrate --judge-config /tmp/core-judge.json --allow-judge-requests --out /tmp/core-calibration.json
```

Calibration reports agreement, false passes, false failures, inconclusive and
missing results per dimension, with the number actually judged. Invalid/provider
responses never receive agreement credit. No synthetic candidate labels are
shown to the judge. Labels remain developer-authored, not human-validated gold.
Mocked provider tests prove request/validation/accounting behavior; only an actual
judge run can establish whether the model discriminates these examples.

Semantic verdicts remain explicitly `uncalibrated` even when every dimension
passes. Review false positives/negatives and approve the reference labels before
turning model agreement or application quality scores into release gates. The
structured provider and validation are safeguards, not evidence of immunity to
prompt injection or semantic judging errors.

## What constitutes a test case

Each case needs a stable ID, a dataset version, the behavior being tested, an
input or conversation, explicit fixture/precondition requirements, an expected
outcome, and the evidence needed to decide whether it passed. Expected outcomes
are facts, entity IDs, permitted changes and observable behavior; generated prose
is an example, not an exact-match answer key.

Record whether a case is a deterministic contract test or a semantic quality
case. Synthetic quality cases start unreviewed. Do not automatically promote the
old CSV answers in `docs/evaluation-datasets` to gold labels: they predate the
current structured Mentor/Judge contracts and contain neither fixture identity
nor persisted-state evidence.

Do not reconstruct facts missing from a trace. A production incident can inspire
a synthetic regression case, but label it as synthetic and link the relevant
test or code rather than claiming to have replayed the original incident.

## Coverage and evidence

| Area                                        | Deterministic evidence                                                                                                         | Semantic review                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher and Roleplay                        | Correct owned thread, complete turns, persisted assistant reply, language/configuration supplied to runtime                    | Advances the configured task; respects role, constraints and current conversation; no unsupported facts                                       |
| Judge                                       | Structured references, complete criterion set, score arithmetic, threshold rounding, blocking-error override, persisted result | Criterion scores agree with transcript evidence; blockers independently corroborated; equivalent paraphrases scored consistently              |
| Search and retrieval                        | Fixture IDs, tenant/access exclusions, result structure, selected-source boundaries, index readiness                           | Human relevance labels for exact titles, paraphrases, attachment-only facts, ambiguous and no-answer queries                                  |
| Course authoring                            | Request/task/proposal identities, allowed fields, baseline/revision checks, failure visibility, immutable export identity      | Developed lessons meet requested outcomes and source policy; assessment tests taught content; multilingual follow-ups resolve intended target |
| Core–Luma application                       | Accepted proposal, queued application, final receipt, native content readback and unchanged untargeted fields                  | Imported content remains usable and preserves reviewed meaning                                                                                |
| Config generation, practice and translation | Schema/type preservation, job lifecycle, ownership, stable rubric IDs and unchanged numeric settings                           | Usable scenario/rubric; faithful translation; appropriate practice task                                                                       |
| Assistant and Slackbot                      | Actual tool calls/results, account/tenant scope, thread routing, confirmed delivery/transcript acknowledgements where captured | Answer uses the returned evidence, fulfills the latest request and states failures honestly                                                   |
| Voice, transcription and media              | Chunk/event ordering, interruption/cancellation, canonical display/spoken text, asset integrity                                | Listen to actual audio; assess pronunciation, missing words, continuity and naturalness; inspect rendered media                               |

This table defines the target coverage. Consult each repository's dataset and
runner documentation for the executable subset. An unsupported adapter is a
coverage gap, never a passing test. Browser interaction, microphones, external
providers, background workers and live delivery require their own evidence.

## Run and compare

Run deterministic application tests without network providers first. Test the
evaluation checks themselves with both acceptable and deliberately incorrect
results. Missing artifacts, malformed outputs, unsupported cases, timeouts and
application errors must remain accounted for and must not improve a pass rate.

Before an application run, provision a disposable tenant, actors and content
using the repository's existing test factories. Map fixture aliases to the
actual IDs and confirm that each actor can read only the intended entities.
Reset mutable fixtures between cases; use fresh conversations when comparing
base prompts, because existing threads retain their stored system prompts.
Never submit an authoring application against a real customer course.

Compare baseline and candidate with the same dataset version, fixture/index
snapshot, roles/permissions, source revisions, language, runtime route, provider,
model settings and evaluator version. Record repository SHAs and the actual
managed prompt version/content hash when available; a local YAML change alone
does not prove which prompt the application used. Keep credentials out of all
captures. Store sanitized evidence locally in a gitignored location, retaining
case IDs and failure categories.

Report counts for selected, executed, passed, failed, errored and pending-review
cases, grouped by flow and language. Report quality only for reviewed cases and
show the reviewed denominator. A partial run cannot establish whole-suite
success. Latency/cost require measured provider and application evidence; fixture
runtime is not a provider-performance estimate.

For stochastic quality cases, use repeated paired runs with distinct run IDs.
Preserve every attempt, including failures. Choose repetition count and acceptable
variation after measuring baseline variability; do not hide an intermittent
failure behind the best attempt or a single aggregate average.

## Make the benchmark valid before making it a release gate

1. Have a product/domain reviewer check synthetic facts, scenario relevance,
   expected behavior and counterexamples. Store reviewer identity/date and the
   exact reviewed dataset revision outside prompts presented to the model.
2. Build separate development/calibration and held-out cases, splitting by
   scenario family/source rather than randomly separating paraphrases of one
   example. Keep held-out answers out of prompt tuning.
3. Independently label the same calibration outputs, including near-threshold
   passes/fails, plausible wrong answers, refusals and incomplete evidence.
   Resolve disagreement and improve anchors before trusting a judge.
4. If adding an LLM evaluator, give it only permitted source evidence, the
   scenario rubric and captured output. Treat retrieved text and learner content
   as untrusted data. Require a short evidence-based reason and an explicit
   insufficient-evidence result. Do not let the tested model's self-report prove
   success.
5. Measure false passes and false failures against human labels per dimension
   and language. Set quality release thresholds from that calibration and the
   product's risk tolerance. No arbitrary global quality number is configured
   by this baseline.
6. Require every selected deterministic invariant to pass. For access leaks,
   unauthorized writes, silent lost tasks and falsely reported delivery, one
   observed violation blocks acceptance regardless of average quality.

Retrieval relevance and grounded generation are separate measurements. Once
fixture IDs have human relevance judgments, report precision at 5, recall and
nDCG at 10, plus no-answer false positives. Report permission leakage separately
as a hard invariant. Do not infer retrieval quality from fluent answer text.

Grading needs an additional domain review: correct totals alone do not prove
fair or educationally valid scoring. Include acceptable alternative answers,
partial attainment, prompt injection, borderline scores and falsely alleged
blocking errors. Voice needs an audio review: a good transcript cannot prove a
good audible response.

## Langfuse later

Langfuse SDK experiments can wrap application execution and attach traces and
custom scores; UI prompt experiments evaluate prompt/model calls. See the
[SDK experiment documentation](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)
and [dataset documentation](https://langfuse.com/docs/evaluation/experiments/datasets).

After local review, publish versioned cases to the intended project explicitly.
Resolve Core, Luma and Slackbot project identities independently rather than
assuming one connected project represents all three. Preserve the same stable
case IDs in cross-service traces and result artifacts. Propagate correlation
through the HTTP request and worker/job boundary; a local root span does not
automatically correlate distributed execution.

Keep domain expectations in dataset expected outputs/metadata and return real
artifacts from the task. Score native persisted state and tool/delivery receipts
with code, and use calibrated semantic evaluators for content. Start with manual
experiment runs; enable CI comparisons only after reviewed baselines exist.
Application servers may emit their normal telemetry when exercised, so use an
isolated environment with remote exporters disabled for local-only testing.

This PR does not upload datasets, change live evaluation rules, synchronize
prompts or run remote experiments.
