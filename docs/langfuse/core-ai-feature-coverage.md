# Core AI feature experiment coverage

The versioned manifest is `apps/api/test/evaluations/feature-catalogue.v1.json`: 31 feature datasets and 103 synthetic items. Each item exposes normalized `input`, `expectedOutput`, and `metadata` for Langfuse upload. Expectations are developer-authored and pending domain review. A successful transport or nonempty output is never reported as semantic acceptance.

## Source inventory

`traceNames` below lists literal source observation names, where present. SDK `functionIds` are separate metadata; they are not assumed to be trace names. Core global-search embeddings deliberately disable telemetry. The Core authoring bridge delegates model generation to Luma and has no dedicated Core Langfuse wrapper.

| Feature / dataset suffix          | Items | Manual task level    | Source observation names                                                                                                              | SDK function IDs                             |
| --------------------------------- | ----: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `mentor-welcome`                  |     2 | prompt only          | `Start Conversation`, `Generate Prompt`                                                                                               | `ai-mentor-welcome`                          |
| `mentor-teacher-chat`             |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-roleplay-chat`            |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-learner-name`             |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-rag-grounding`            |     2 | prompt only          | `RAG`, `Conversation`                                                                                                                 | `ai-mentor-chat`, `ai-mentor-rag-embeddings` |
| `mentor-voice-spoken-display`     |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-voice-elevenlabs`         |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-voice-interruption`       |     2 | prompt only          | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `mentor-transcription`            |     2 | native audio socket  | `transcription-generator`                                                                                                             | None in this Core source                     |
| `mentor-summary`                  |     2 | prompt only          | `Summary`, `Generate Prompt`                                                                                                          | `ai-summary`                                 |
| `course-translation`              |     2 | prompt only          | `translation-generator`                                                                                                               | `course-translation`                         |
| `mentor-config-create`            |     3 | prompt only          | `Generate AI Mentor Configuration Draft`                                                                                              | `ai-mentor-configuration-generation`         |
| `mentor-config-improve`           |     3 | prompt only          | `Generate AI Mentor Configuration Draft`                                                                                              | `ai-mentor-configuration-generation`         |
| `mentor-config-repair`            |     3 | prompt only          | `Generate AI Mentor Configuration Draft`                                                                                              | `ai-mentor-configuration-generation`         |
| `mentor-config-validate`          |     3 | prompt only          | `Validate AI Mentor Configuration Draft`                                                                                              | `ai-mentor-configuration-validation`         |
| `judge-config-create`             |     2 | prompt only          | `Generate AI Judge Configuration Draft`                                                                                               | `ai-judge-configuration-generation`          |
| `judge-config-improve`            |     2 | prompt only          | `Generate AI Judge Configuration Draft`                                                                                               | `ai-judge-configuration-generation`          |
| `judge-config-repair`             |     2 | prompt only          | `Generate AI Judge Configuration Draft`                                                                                               | `ai-judge-configuration-generation`          |
| `judge-config-validate`           |     2 | prompt only          | `Validate AI Judge Configuration Draft`                                                                                               | `ai-judge-configuration-validation`          |
| `daily-practice`                  |     3 | prompt only          | `Generate AI Mentor Configuration Draft`                                                                                              | `ai-mentor-configuration-generation`         |
| `mentor-rag-embeddings`           |     2 | embedding model only | No dedicated literal name                                                                                                             | `ai-mentor-rag-embeddings`                   |
| `global-search-embeddings`        |     2 | embedding model only | No dedicated literal name                                                                                                             | None in this Core source                     |
| `global-search-native`            |     2 | application http     | No dedicated literal name                                                                                                             | None in this Core source                     |
| `mentor-native-chat`              |     2 | application http     | `Conversation`                                                                                                                        | `ai-mentor-chat`                             |
| `core-luma-authoring-proposal`    |     2 | native proposal http | No dedicated literal name                                                                                                             | None in this Core source                     |
| `core-luma-authoring-apply`       |     2 | application http     | No dedicated literal name                                                                                                             | None in this Core source                     |
| `assistant-conversation`          |     2 | native workflow http | `core-assistant-run`, `core-assistant.context`, `core-assistant.validate-outcome`, `core-assistant.complete`, `core-assistant.failed` | `core-assistant`                             |
| `assistant-authorized-read-tools` |     2 | native workflow http | `core-assistant-run`, `core-assistant.context`, `core-assistant.validate-outcome`, `core-assistant.complete`, `core-assistant.failed` | `core-assistant`                             |
| `assistant-readonly-failure`      |     2 | native workflow http | `core-assistant-run`, `core-assistant.context`, `core-assistant.validate-outcome`, `core-assistant.complete`, `core-assistant.failed` | `core-assistant`                             |
| `mentor-verified-judge`           |    20 | application http     | `Thread Evaluator`, `Generate Evaluation`                                                                                             | `ai-judge`                                   |
| `mentor-blocker-verification`     |    20 | prompt only          | `Generate Evaluation`                                                                                                                 | `ai-judge`                                   |

The manifest links every feature to its authoritative source files and prompt IDs. Teacher and Roleplay generation/validation variants are both present. Verified assessment includes the 20 English/Polish scope, negation, admission, third-party, quotation, hypothetical, ambiguous and multiple-blocker cases from issue 2019 / PR 2018.

## Prepare without provider or application calls

Use Node 22.15 or later. Normal repository dependency installation must include `@repo/prompts` (its declared YAML parser) and the web app (its declared Socket.IO client). No new provider or Langfuse credentials are discovered automatically.

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run-feature.ts --mode list
pnpm --filter=api exec node --import tsx test/evaluations/run-feature.ts --mode prepare --feature mentor-teacher-chat --prompt-snapshots /private/tmp/production-prompts.json --out /private/tmp/core-teacher-prepared.json
```

Snapshot format is `{ "label": "production", "prompts": [{ "name": "teacherPrompt", "version": 7, "prompt": "...", "config": {}, "labels": ["production"] }] }`. Per-record `label: "production"` is also supported. Supply every required fragment for the selected items. Missing managed fragments fail; there is no silent local fallback. `--prompt-source local` explicitly renders authoritative YAML with local origin recorded. Each prepared/result fragment records its name, pinned version, SHA256 and production/local origin. Managed templates are not edited.

## Run an explicit model task

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run-feature.ts --mode run --feature mentor-teacher-chat --case mentor-teacher-chat-grounded-v1 --prompt-snapshots /private/tmp/production-prompts.json --provider-config /private/tmp/feature-provider.json --allow-model-requests --out /private/tmp/core-teacher-result.json
```

Provider configuration is `{ "model": "<explicit model>", "apiKeyEnv": "EVAL_FEATURE_API_KEY", "timeoutMs": 60000 }`, optionally with an HTTPS `baseURL`. Embedding datasets require an embedding model in a separate explicit configuration. Prompt tasks reuse production structured-output contracts where applicable, validate returned shapes, and remain `needs_review` for quality. Embedding tasks check finite aligned vectors and relevant-versus-distractor cosine ordering; they do not prove native retrieval permissions or index state. Provider adapters disable their own telemetry and request `store: false` for OpenAI text generation. Remote experiment tracing/scoring belongs to the separately configured Langfuse runner.

## Run native application tasks with disposable fixtures

```sh
pnpm --filter=api exec node --import tsx test/evaluations/run-feature.ts --mode run --feature assistant-conversation --case assistant-conversation-grounded-v1 --app-config /private/tmp/core-feature-fixtures.json --allow-app-requests --out /private/tmp/core-assistant-result.json
```

Application configuration retains the existing loopback/disposable-tenant fence. Fixture keys are the normalized **item IDs**, rather than the referenced legacy case IDs. Example:

```json
{
  "baseUrl": "http://127.0.0.1:3000/api",
  "disposableTenant": true,
  "allowAuthoringWrites": true,
  "fixtures": {
    "assistant-conversation-grounded-v1": {
      "isolated": true,
      "cookieEnv": "EVAL_ASSISTANT_COOKIE",
      "threadId": "<fresh-owned-assistant-thread-id>"
    },
    "mentor-transcription-grounded-v1": {
      "isolated": true,
      "cookieEnv": "EVAL_AUDIO_COOKIE",
      "audioPath": "/private/tmp/synthetic-dictation.pcm",
      "audioSha256": "<SHA256-of-raw-file-bytes>",
      "audioSampleRate": 16000
    }
  }
}
```

- Assistant tasks use availability, an owned fresh thread, the actual message POST, bounded durable-run polling, and persisted final user/assistant message identities. Read-content tasks additionally require nonempty `expectedSourceUrls` and explicit `forbiddenSourceUrls` in the fixture. Final source readback supports verification of the server-accepted outcome; raw internal tool calls remain application trace evidence.
- Proposal-only authoring uses the real Core–Luma session/request/proposal path, stops before proposal acceptance/application, and verifies native context remains unchanged. The apply task verifies receipt identities and native readback. Authoring fixtures need distinct disposable course IDs. The older stale-baseline negative apply case remains explicitly `not_run` until a concurrent-edit adapter is supplied; it is not substituted with a successful title change.
- Transcription uses the actual authenticated Socket.IO `/ws` namespace and `/api/ws` path, sending `startAudio`, PCM `audioChunk` frames and `stopAudio`. A supplied synthetic 16 kHz, mono, signed 16-bit little-endian PCM asset must match its SHA256 and the versioned expected script. The returned transcript stays pending semantic review; punctuation equality is not a quality gate. No multipart transcription endpoint is invented.

Missing fixtures, authorization, provider availability, mismatched source/rubric/transcript, failed/cancelled runs and timeouts fail or remain explicitly not run. Cookies, provider keys and private error bodies are excluded from reports. Microphone capture, browser playback, audible TTS quality and deployment readiness require their own checks.

## Local validation and interpretation

```sh
pnpm --filter=api test --runInBand test/evaluations
pnpm --filter=api exec eslint 'test/evaluations/*.ts'
```

Transport-controlled tests exercise source prompt rendering, pinned snapshot selection, strict structured-output validation, vector ordering, assistant native completion/source checks, proposal-only non-application, and dictation protocol/cleanup. They do not prove a real model distinguishes the regression examples or that the deployed Core environment completes the native flows. Manual model/app execution and remote online evaluator configuration must be reported separately.
