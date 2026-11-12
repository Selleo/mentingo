# Running Core AI tests and experiments

Run commands from the repository root using Node 22.15+, pnpm and installed/built workspace dependencies. See the [matrix](core-test-case-matrix.md) for which cases each runner owns.

## Package commands for local use

| Command                           | Purpose                                                                             | Running services / credentials                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:ai:regression`         | Run the deterministic evaluation harness and configuration/recording tests (including repository-local configuration/recording checks) | Node/pnpm dependencies and Python 3; no launched Core/Luma, model keys or Langfuse                                                       |
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

These are controlled tests, not real recognition or listening checks. The matrix links more existing audio/capture/recovery specs.

## 2. Run the normal Core–Luma application contract tests

Use the existing E2E environment with disposable test database, migrations and required service configuration. These specs use controlled Luma transport; they do not measure course-generation quality or need Langfuse:

```sh
NODE_OPTIONS=--experimental-vm-modules pnpm --filter=api test:e2e --runInBand --testPathPattern='course-authoring-(http-roundtrip|native-apply)\.e2e-spec\.ts'
```

These tests cover HTTP request/proposal/application receipts, native persistence, rollback and retry deduplication. Do not point test configuration at production.

## 3. List or prepare feature experiments offline

```sh
pnpm eval:ai --mode list
pnpm eval:ai --mode prepare --feature mentor-teacher-chat --prompt-source local --out /tmp/core-evals/teacher-prepared.json
```

Local source is explicitly nonproduction. For comparison against managed production prompts, replace `--prompt-source local` with `--prompt-snapshots /tmp/core-evals/production-prompts.json`. Supply all required fragments in the [snapshot format below](#prompt-snapshots). Snapshots pin prompt names, versions and hashes. Preparation performs no model, application or Langfuse requests; it cannot pass a quality case.

### Prompt snapshots

Supply every prompt fragment needed by the selected cases:

```json
{
  "label": "production",
  "prompts": [
    {
      "name": "teacherPrompt",
      "version": 7,
      "prompt": "PINNED_TEMPLATE_TEXT",
      "config": {},
      "labels": ["production"]
    }
  ]
}
```

Each record can also use `label: "production"`. Missing managed fragments fail; there is no silent local fallback. `--prompt-source local` explicitly uses authoritative YAML as a nonproduction source. Results record fragment names, versions, origin and hashes. Source files, prompt IDs and trace names are listed in `apps/api/test/evaluations/feature-catalogue.v1.json`; SDK function IDs are not assumed to be observation names.

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

Provision a local disposable Core/Luma environment with workers and owned fixtures. The runner does not seed fixtures. Use an app config matching [the fixture contract below](#application-fixtures): loopback base URL, `disposableTenant: true`, fresh isolated resources, cookies referenced only by environment-variable name, and fixtures keyed by feature item ID. Authoring needs `allowAuthoringWrites: true` and a distinct disposable course per case.

```sh
pnpm eval:ai --mode run --feature core-luma-authoring-apply --case core-luma-authoring-apply-grounded-v1 --prompt-source local --app-config /tmp/core-evals/app-fixtures.json --allow-app-requests --out /tmp/core-evals/apply-result.json
```

This can call Luma's configured provider and write to the disposable course. For proposal-only checking select `core-luma-authoring-proposal` and its item ID instead. The stale-edit adversarial case performs a real concurrent title edit, requires a typed `baselineChanged` application conflict, and verifies that the concurrent title and unrelated fields remain intact. It must not produce an applied receipt.

For actual transcription, select `mentor-transcription` and supply a synthetic 16 kHz mono PCM fixture, expected script and matching SHA256 as documented. The same flag enables authenticated socket calls. No microphone is captured; a transcript is not proof of playback or voice quality.

### Application fixtures

Feature runner fixture keys are the normalized item IDs from the feature catalogue. Use distinct fresh threads/courses per case; the runner does not create or reset them.

```json
{
  "baseUrl": "http://127.0.0.1:3000/api",
  "disposableTenant": true,
  "allowAuthoringWrites": true,
  "fixtures": {
    "assistant-conversation-grounded-v1": {
      "isolated": true,
      "cookieEnv": "EVAL_ASSISTANT_COOKIE",
      "actorUserId": "SYNTHETIC_USER_ID",
      "threadId": "FRESH_OWNED_THREAD_ID"
    },
    "core-luma-authoring-apply-grounded-v1": {
      "isolated": true,
      "cookieEnv": "EVAL_AUTHOR_COOKIE",
      "actorUserId": "SYNTHETIC_AUTHOR_ID",
      "courseId": "DISPOSABLE_COURSE_ID"
    },
    "mentor-transcription-grounded-v1": {
      "isolated": true,
      "cookieEnv": "EVAL_AUDIO_COOKIE",
      "actorUserId": "SYNTHETIC_USER_ID",
      "audioPath": "/tmp/core-evals/synthetic.pcm",
      "audioSha256": "SHA256_OF_FIXTURE_BYTES",
      "audioWavPath": "/tmp/core-evals/synthetic.wav",
      "audioWavSha256": "SHA256_OF_MATCHING_WAV_BYTES",
      "audioSampleRate": 16000
    }
  }
}
```

Assistant source-read cases additionally need nonempty `expectedSourceUrls` and explicit `forbiddenSourceUrls`. Transcription uses Socket.IO namespace `/ws`, path `/api/ws`, and `startAudio` / PCM `audioChunk` / `stopAudio`; supply mono signed 16-bit little-endian 16 kHz PCM matching the expected script. It does not capture a microphone.

Verified-assessment cases additionally need `lessonId`, `blockingErrorIds` mapping both `B1` and `B2` to persisted UUIDs, and optionally `rubricCookieEnv` for an independently authorized rubric reader. Seed the exact case transcript, localized rubric and fresh active owned thread. The adapter compares these before invoking Core's Judge endpoint and reading back the completed thread.

### Disposable runtime and fixture requirements

The [native fixture provisioner](../../apps/api/test/evaluations/provision-native-fixtures.ts) uses repository services and factories. It requires `MIGRATOR_DATABASE_URL` targeting `127.0.0.1:15432`, a matching `CORE_NATIVE_DISPOSABLE_DATABASE` named `core_eval_*`, and an explicit `CORE_NATIVE_ARTIFACT_ROOT`. It never resets a database and refuses to overwrite an existing fixture identity file. Run the existing Core and Workflow migrations first, with separate Redis and SMTP services. Build workspace packages in the isolated worktree and resolve its `@repo/*` dependencies to that worktree's outputs.

Use an isolated API `PORT`, ordinary `/api/auth/login`, and private cookie environment files. Set an explicit JWT duration such as `24h`; the existing JWT library interprets a numeric string as milliseconds. Include `actorUserId` so the driver verifies the authenticated identity before native actions.

- Assessment courses must expose the requested `availableLocales`; authorized rubric and transcript readbacks must match the exact language and stable blocker IDs.
- Published non-public articles may be readable by authenticated students. Use an editor-only draft and a genuinely foreign tenant for forbidden search fixtures. Verify actual IDs, tenant/archive state and access; a title is not an archive or permission flag. Keep original and supplemental search queries distinct. Published course metadata visibility does not imply access to full course content.
- Audio fixtures need nonempty signed 16-bit mono 16 kHz PCM with verified samples/duration, plus a matching WAV container and hashes for media review. File existence or checksum alone does not prove nonempty audio.
- Open an authoring session before capturing its baseline: setup normalizes legacy block identities. Upload explicit synthetic source text through the native source endpoint and wait for ingestion before requesting a proposal.
- `authoringResumeSessionId` explicitly continues one saved waiting question on its owned course/language. The driver verifies the unchanged title-only request, answers once from fresh canonical context, then uses ordinary accept/apply/readback. It creates no new request or regenerated proposal; preserve the question and answer.

### Native evidence and saved-output imports

Sanitized native HTTP/socket evidence records actor/resource identities, paths, statuses, response hashes and actual state. Cookies stay private. It does not claim raw provider HTTP or internal provider traces were captured.

A Mentor chat completes a response by consuming the stream and reading its persisted nonempty assistant message ID. The message schema exposes no typed job-terminal status, and an active thread is not a completed lesson. Assistant tool counters alone are insufficient: where needed, recover original completed `executeTool`, `validateOutcome` and `complete` results read-only from the isolated native Workflow persistence, scoped to the owned run/user/tenant. Metadata readers such as `list_courses` can establish enrollment state without incrementing the full-content-reader counter. Never replay a tool or invent provider telemetry as evidence.

The audio driver sends chunks and `STOP_AUDIO`, then observes the final transcript event. Separate server end processing may be inferred from that source protocol and final response, but no separate end acknowledgement or persisted/provider-wire transcript may be invented. Equivalent number spellings preserve an amount; changes to amount, currency, negation, actor or scope still fail. Audible accuracy requires the actual hashed audio and appropriate independent listening evidence.

Reassessment must retain original input/output and source-report hashes, identify imports explicitly, and preserve prior failures and contract corrections. If a local receipt is lost, recover only identities established by preserved strict verification and mark the recovery; never invent unavailable run names or media receipt fields. Keep any duplicate import separately and select the original verified root rather than replacing it opportunistically.

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

This calls the judge on 16 labeled candidates across eight scenarios, not the application. See [local semantic evaluation below](#local-semantic-evaluation) for `--mode http` and `--mode evaluate` captures. Labels need independent domain review.

### Local semantic evaluation

The older application runner uses IDs from `dataset.v1.json` and `assessment-cases.v1.json` as fixture keys. It supports search, Mentor, title-only authoring and verified assessment. For example:

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode http --allow-app-requests --config /tmp/core-evals/legacy-fixtures.json --case mentor-teacher-multi-turn --out /tmp/core-evals/mentor-capture.json
pnpm --filter=api exec node --import tsx test/evaluations/run.ts --mode evaluate --capture /tmp/core-evals/mentor-capture.json --judge-config /tmp/core-evals/judge.json --allow-judge-requests --out /tmp/core-evals/mentor-judged.json
```

The local semantic judge analyzes captured legacy reports; it does not rerun the app or accept arbitrary feature/preparation reports. Its exact structure and quote-validation checks are described in [the check reference](core-evaluator-checks.md#separate-local-semantic-judge-validation).

Compare baseline and candidate using the same dataset, source/index snapshot, actors, permissions, language, runtime route, provider/model settings and evaluator version. Use fresh threads because they retain system prompts. Preserve failures and every stochastic attempt rather than selecting the best output. Keep paired/paraphrased scenarios in the same calibration/held-out split, and keep held-out answers out of prompt tuning. Review synthetic labels before treating model scores as release gates.

## Can Langfuse trigger these directly?

| Action                                                         | Available in this setup?                                                 | What executes                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Run ordinary Jest/Vitest/E2E checks                            | Yes, terminal/existing repository CI                                     | Test code; no Langfuse required                                          |
| Run the complete feature/application runner                    | Yes, explicit CLI commands above                                         | Your local application/model environment                                 |
| View/compare uploaded experiments and their scores in Langfuse | Yes, after actual reports are uploaded                                   | Existing evaluator rules score submitted items                           |
| Trigger a prompt/model-only experiment from Langfuse UI        | Langfuse product capability; no Core UI experiment preset was configured | Prompt/model generation; not Core auth, persistence, sockets or tools    |
| Click in Langfuse to run this Core CLI against an application  | Not configured                                                           | Requires a deployed external worker/service and configured webhook       |
| Automatically run a dataset after a prompt changes             | Not configured                                                           | Requires an explicit CI/webhook policy and suitable runtime fixtures     |
| Automatically judge new application traces                     | Configured in `remote-setup.json`                                        | Scores matching captured observations; does not execute regression cases |

Langfuse supports [UI prompt experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-ui) and [UI webhook triggers for external SDK experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk#configure-webhook). Current full application execution is CLI-based. A future UI trigger would need a deployed authenticated job receiver, disposable fixture provisioning, bounded execution and result export; that service has not been added. Enabling evaluators does not create it.

## Result meanings

`prepared`: offline setup only. `needs_review`: output captured and available checks ran; semantic quality remains pending. `failed`: a concrete check/transport failed. `not_run`: missing prerequisites or unsupported adapter. Langfuse judges use `pass`, `fail`, `insufficient_evidence`; the code score `present` only indicates captured output. Report selection/denominators, not just averages. A pass from one layer cannot establish a different layer's outcome.

### Hosted audio evaluation compatibility

The recorder keeps actual WAV attachments on the experiment root and validates
size, MIME and SHA256 before uploading them. Independently, normalization writes
`metadata.judgeCompatibleOutput` as a deep copy of the **actual captured output**
before media markers replace artifact objects. Incoming metadata cannot supply or
overwrite this projection. Its provenance records the original output hash; it
never copies an expected answer or turns a failed media review into a pass.

Known audio experiment evaluators (`mentor-transcription` in Core; `voice-tts`,
`demo-voice-assessment`, `voice-conversation`, `dictation-transcription` and
`voice-transcription` in Luma) map their `output` variable to metadata JSONPath
`$.judgeCompatibleOutput`. This prevents a text evaluator from automatically
receiving unsupported raw audio while retaining actual transcripts, native event
and request evidence, independent listening results and rejected negative controls.
This textual projection does not itself listen to the WAV. Audible acceptance
still needs the captured actual-media review required by the case. A missing
execution, absent transcript, failed control or unavailable native evidence remains
a failure or insufficient evidence.

Updating an existing evaluator requires a full preserved-definition PATCH because
Langfuse replaces definition fields as a unit. `preserved_audio_definition` keeps
the existing prompt, model configuration, output contract and every other variable
mapping unchanged. Verify project identity, current evaluator version, complete
before/after definition hashes and unchanged rule assignments before re-recording.
Re-record saved executions with source-report and original-output hashes, explicit
import provenance and zero new generation calls. Preserve prior pending/failed
traces. If an audited case contract changed, retain the original contract hashes
and explain that rebinding separately; never alter actual recognized speech.

Voice's bounded judge projection summarizes only routine `audio:chunked` input
frame acknowledgments, retaining ordered sequences, gaps/duplicates, sample counts,
bounds, complete-log hash and original report path/hash. It keeps every speech,
error, unknown, interruption and terminal event unchanged. Both `metadata` and
`experiment_item_metadata` variables map to `$.judgeCompatibleMetadata` for this
one voice evaluator; that derived context omits only duplicate output copies.
The original full root output/metadata and media attachments remain intact.

A stale `response_only_uncalibrated` capture label can be corrected only when
actual positive audio observations/checks and a matching, genuinely rejected
altered-negation control substantiate calibration. The recorder retains the old
label/native metadata hash, source report hash and specific supporting artifact
hashes in `compatibilityCorrection`. It changes neither actual output nor a model
verdict. Cross-language controls must be labelled with their transfer limits.

If an original streaming WAV has an unfinalized header, preserve its bytes/hash.
A valid playback container may be derived from the exact native submitted PCM,
without resampling or new generation. Verify decoded WAV frames equal those PCM
bytes, and record channels, width, rate, sample count, duration and both hashes.
Independent blind listening observes that pinned audio; text-only structural
judges assess those recorded observations and native outputs, not raw WAVs.
