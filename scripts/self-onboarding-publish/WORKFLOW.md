# Self-onboarding workflow

The Helpdesk branch adds a version-triggered recording/publishing path alongside the
existing release recap. It creates stable short videos per language, each containing 1–3 related complete flows. It does not run on GitHub Release publication.

## Triggers and inputs

`self-onboarding-on-version.yml` queues `self-onboarding.yml` on the repository's
trusted default branch when a `vX.Y.Z` version tag is pushed (prerelease suffixes are
supported). Both workflow files must first exist on the appropriate branch/tag.
Manual dispatch accepts an exact version tag, domains, languages, force, dry-run,
publish and resume-publication. Empty domains means all reviewed domains. English and Polish are the default automatic batch, reusing one verified scenario with separate native-language captures.
GitHub suppresses ordinary push-trigger chaining from tags created with its default
workflow token; a version-creation workflow using that token should dispatch the
Helpdesk workflow explicitly, using the same exact tag/default-branch contract.

Production generation/publication uses the default branch. This standalone Helpdesk
workflow uses the existing `release-film` environment to access its already configured
Claude Code subscription token; it does not modify the release-film workflow.
`self-onboarding-publishing` keeps its separate publishing token. Manual dispatch defaults to publication
off; the version-tag queuer explicitly turns it on.

## Test a specific spec before merging

Use the standalone `self-onboarding.yml` workflow. A push changing that file on a
`jh_*` branch runs only its registration job, with no environment secrets, recording
or publication. This initial run makes its own API/CLI manual entry available before
merging; the release-film workflow is not involved. After registration, run:

```sh
gh workflow run self-onboarding.yml --repo Selleo/mentingo \
  --ref jh_feat_helpdesk_ui_preview \
  -f business_spec=docs/specs/learning-paths-business-spec.md \
  -f languages=en,pl -F test_mode=true -F publish=false
```

For Articles, use `business_spec=docs/specs/knowledge-base-articles-business-spec.md`.
The registered feature includes section management, authoring, localization, preview, cover images and public access.
For News, use `business_spec=docs/specs/news-hub-business-spec.md` to generate the complete news feature video.

For a single-flow smoke test, add `-f test_flow=create-news-draft` with the News spec and
`test_mode=true`. The full registry and plan are validated first; only the selected flow is filmed.
The resulting manifest is explicitly marked test-only and the publisher rejects it.

Add `-F dry_run=true` for coverage/impact analysis without recording. The source is
the selected workflow branch commit by default; `target_ref` can select another Git
ref (for a remote branch use `origin/<branch>`) or exact commit. No version tag is
needed. An internal test version labels the artifacts and the publisher rejects
their `testMode` marker. `registration_only=true` checks dispatch without model calls
or credentials. The GitHub UI's Run workflow button may still require the file on
the default branch; use the CLI for this pre-merge test.

The selected spec must be an exact registered `docs/specs/*.md` path, not a glob.
It selects all registered short videos for features whose declared sources include that spec; it
does not omit other required flows from the selected feature. An unknown spec fails
before any model calls. The same Helpdesk entry accepts optional `domains` to narrow specs shared by more
than one feature video. Its dedicated `pr-self-onboarding-ci.yml` tests generation
and SDK publishing without adding Helpdesk jobs to release-film CI.

Recording jobs, including branch tests, use the existing `release-film` environment.
`CLAUDE_CODE_OAUTH_TOKEN` already exists there and does not need to be read, copied,
or replaced with an Anthropic API key. The environment currently allows only `main`
and `staging`; allowing `jh_feat_helpdesk_ui_preview` requires an explicit environment
branch-policy change. The user is waiting for PM approval before making that change;
this implementation has not changed the policy or run paid recording.

Add `ELEVENLABS_API_KEY` to that environment (or repository secrets), and configure
four distinct voice IDs in repository or recording-environment variables:
`ELEVENLABS_VOICE_ID_FEMALE_1`, `ELEVENLABS_VOICE_ID_FEMALE_2`,
`ELEVENLABS_VOICE_ID_MALE_1`, `ELEVENLABS_VOICE_ID_MALE_2`.
Choose two female and two male voices available to the API key; the slot labels
are maintained configuration, not a provider-verified gender check. Each feature
video randomly selects one of the four with equal probability. That selection is
saved before recording and shared by all chapters, PL/EN variants and retries.
Future versions retain the same narrator while its ID remains in the pool.
An incomplete or duplicate pool fails before model work. The workflow no longer
uses the single `ELEVENLABS_VOICE_ID` variable; local single-voice builds remain compatible.
Optional `ELEVENLABS_MODEL_ID` defaults to `eleven_v4_turbo`. Narration uses its actual
[Text-to-Dialogue with timestamps](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
endpoint, returning one MP3 and whole-utterance character timing in a single response.
Offline narration does not stitch WebSocket chunk timing and does not use the legacy
TTS endpoint for v4. Requests do not automatically retry paid synthesis or fall back
to another voice/model. Registration-only jobs use no environment or provider credentials.

Fresh test state needs no S3 or Helpdesk/Bunny/OpenAI publishing credentials. The
workflow skips private production-cache restore/checkpoint and publication. After
redaction it uploads only videos, captions, posters, timeline and manifest files as
`self-onboarding-test-videos` (14 days), not publisher state, AI logs or checkout files.
Download the artifact from the Actions run to inspect the MP4 and chapters. A failed
flow is skipped while successful flows still produce videos. The manifest and Actions
summary list skipped captures and language renders. If every flow fails, the run emits
a diagnostic manifest without a video or publication.

Recording attempts also upload `self-onboarding-progress` after success or failure,
retained for 14 days. It contains any available raw captures, rendered flow clips,
audio, captions and failure screenshots, with sanitized startup diagnostics and an
index identifying the output as partial review material. Early startup failures
may have only diagnostics and screenshots because recording has not begun.
This preserves reviewable footage. Assembled videos contain available chapters; omitted flows are listed explicitly in the manifest and summary.
Browser sessions, traces, private build checkpoints and checkout source are excluded.
The artifact is for inspection; test retries still start with fresh build state.
Visual review is off by default. Set `visual_review=true` to collect one bounded,
advisory image review per capture/language. Findings in `run/review/claim-review.json`
and per-flow reports never rewrite narration or stop generation. `skipped-flows.json`
lists failed captures/renders. Scenes target 20–40 seconds with 3–4 concise narration
sentences, two browser attempts and a shorter worker deadline. English overlays reuse
canonical narration without another model call. Startup, configuration, cache integrity
and final media validation still fail explicitly.

## Required configuration

Repository or relevant environment secrets:

| Secret                             | Scope                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN`          | Existing Claude subscription, semantic planning/camera/visual review only |
| `ELEVENLABS_API_KEY`               | Narration and text redaction only                                         |
| `GUIDE_PUBLISH_API_KEY`            | Separate publisher job only; never sent to Bunny                          |
| `HELPDESK_BUILD_ACCESS_KEY_ID`     | Private build-store restore/checkpoint steps only                         |
| `HELPDESK_BUILD_SECRET_ACCESS_KEY` | Same private S3-compatible prefix                                         |

Repository variables:

| Variable                       | Value                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- |
| `GUIDE_API_URL`                | Deployed Helpdesk HTTPS origin, e.g. `https://help.mentingo.com`       |
| `ELEVENLABS_VOICE_ID_FEMALE_1` | First female narrator ID                                               |
| `ELEVENLABS_VOICE_ID_FEMALE_2` | Second female narrator ID                                              |
| `ELEVENLABS_VOICE_ID_MALE_1`   | First male narrator ID                                                 |
| `ELEVENLABS_VOICE_ID_MALE_2`   | Second male narrator ID                                                |
| `ELEVENLABS_MODEL_ID`          | Optional; pinned default `eleven_v4_turbo`                             |
| `HELPDESK_BUILD_S3_URI`        | Exclusive private prefix, e.g. `s3://private-builds/mentingo-helpdesk` |
| `HELPDESK_BUILD_REGION`        | Optional, defaults `us-east-1`                                         |
| `HELPDESK_BUILD_ENDPOINT_URL`  | Optional HTTPS endpoint for existing S3-compatible storage             |

Use an existing private S3-compatible build bucket. This introduces no database or
always-running build service. Credentials need list/read/write and multipart-upload
access limited to that prefix; no public access or object deletion is needed.
Archive snapshots are immutable; `latest.json` advances only after upload succeeds.
Retention/lifecycle must preserve the current snapshot and its pointer. Scene
workers get none of the storage, publishing or ElevenLabs credentials. The publisher
state contains a resumable TUS resource URL and must remain in this private store,
not public GitHub artifacts. Bunny library/OpenAI keys remain solely in Helpdesk.

## Selection, recording and assembly

The reviewed registry is
`.agents/skills/release-film/projects/mentingo-self-onboarding.json`. Its app-wide coverage is audited against the shared area registry, application routes and business specifications. The coverage inventory is documented in `docs/specs/self-onboarding-app-coverage.md`. Business
specifications define scope; target-version implementation and deterministic test
helpers must establish the real flow. Fixture gaps or unavailable external features are recorded as explicit failed flows while other videos continue. They are never replaced with fake API responses or quietly omitted.

Changed module/spec/shared-navigation paths select candidates for semantic review.
The planner compares each flow with its last checked commit, including full relevant
diffs/specs and reviewed contracts. It records changed/unchanged decisions with
source evidence. Refactoring, performance work and grammar edits can be classified
unchanged. Uncertain/missing model output, oversized evidence, stale/non-ancestor
baselines and missing registry coverage block generation. Newly discovered flows and explicitly retired flows are incorporated as validated
data contracts, then a second complete coverage check must pass before recording.
Discovery paths are bounded to supplied specs and the feature’s existing source
roots, with actual target-tree verification. Ambiguous changes block generation;
model output cannot add executable setup.

Each selected flow is filmed and narrated independently with the existing release-film harness. Browser assertions and action pins validate the flow; optional visual review remains advisory. Failed flows are recorded explicitly without discarding other usable chapters. Release framing and recap duration limits do not govern tutorial selection.

The authoring worker prepares one verified, locale-aware Playwright scenario. English and Polish replay it against their native application UI and synthetic examples. Use stable test IDs, real application translation keys through `recordingText`, and bilingual sample values through `recordingValue`. The fixture updates the seeded person's language and browser locale. Polish output requires Polish footage; failure to replay it is a `localized-capture` skip rather than an English-video fallback.

The passing scenario and base-spec location travel inside the checksum-verified private capture bundle. Adding a language requires browser replay but no new authoring worker. A same-contract refresh tries the saved scenario before requesting repair. Legacy English-only bundles need a fresh locale-aware recording once. Unchanged native flows skip camera and speech. Translation and paid speech caches are independent of visual settings; speech cache files are checksum-checked. PCM narration is mixed continuously across video cuts instead of encoding sentence fragments into each visual segment.

Each language has its own localized title, narration, labels and captions, spoken by the same saved ElevenLabs voice. Narration requests explicitly use that language. Chapter offsets come from measured language-specific media durations. Changing voice/model settings rebuilds narration from retained native footage; changing branding can reuse existing speech.

Removing a video's saved voice ID from the pool randomly assigns a remaining voice
and regenerates all selected languages' narration, keeping each video's chapters
consistent. Adding/reordering pool entries does not change a retained narrator.

Current Helpdesk DTOs accept prerequisites in chapter descriptions. Typed
chapter-level audience/feature filtering is a separate service contract change;
this workflow does not claim to enforce those restrictions in search.

## Stable video registry and completeness

Each feature in `mentingo-self-onboarding.json` has an explicit `videos` registry. Every entry has a stable key,
editorial title/description and an ordered list of 1–3 `flowIds`. All 81 registered flows are assigned exactly
once across 29 videos. Validation rejects unknown IDs, missing assignments, duplicate membership and duplicate
video keys, including collisions across features. No grouping depends on array positions, automatic chunking
or an LLM rewriting the grouping. Pending bundles are bound to the selected registry fingerprint;
changing grouping while publication is pending requires an explicit migration/resume decision.

Semantic coverage still reviews the entire feature. A discovered/retired flow that no longer matches the
partition blocks before camera setup; update the explicit registry instead of silently appending or dropping
it. Renaming/removing previously checkpointed video keys requires an explicit migration; known published
monoliths must be retired before new group keys can publish, preventing parallel old/new catalog entries.

Capture, narration and render caches remain per flow and language. Group identity includes its stable key,
ordered membership, text, segment identities and voice/render profile. Changing one flow rebuilds only its
segment and affected video in each language. Unchanged groups are not assembled or uploaded. Group metadata
translations are cached independently. Scenes still target 20–40 seconds; durations are a target, never a reason
to cut off an outcome.

`manifest.json.videoCoverage` lists every selected video and language as assembled, unchanged or failed.
Required flow IDs and explicit skipped IDs accompany each assembled video. A final producer gate rejects a
missing/duplicated group; publisher validation rejects missing/unexpected chapters and cross-video duplicate
flow IDs. Individual capture failures remain explicit partial output, never an unnoticed omission or a reason
to discard other groups. Publication completion clears flags per video while preserving feature-level semantic
baselines and portable capture caches.

The service, pinned Guide SDK and publisher accept stable app-area keys matching
`^[a-z0-9][a-z0-9._-]{0,127}$`. Core maps pages through the shared area registry; private
recording contracts map each area to business specifications and short video groups.
Revision metadata carries a localized `domainLabel`. Public domain discovery derives
keys and labels from finalized, published tutorials, with requested-language and English
fallbacks. Adding an area no longer requires a Rust enum change. Apply the forward
SQLx migration before deploying the upgraded service. A bundle is limited to 256
video/language entries. Registration does not prove successful recording or publication.

## Publication and recovery

The publisher validates bundle provenance, paths and checksums, then uses the
pinned Guide SDK from Core's existing dependencies. Draft creation, media preparation,
TUS upload, finalization/indexing and explicit publication have separate persisted
steps. Media bytes stream to Bunny. A finished upload is not publication.

Whole-workflow concurrency serializes private state writers. Successful flow clips
survive a later flow failure; dirty domains remain marked for assembly/publication.
A pending complete bundle blocks later-version generation until resumed. For pending
encoding/indexing or interrupted upload, dispatch the same version with
`resume_publication=true`; this does not record anything. The default publishing
poll deadline is 45 minutes, after which the saved operation remains resumable.
Transient processing delays can finish in Helpdesk between runs. Explicitly failed
recoverable operations require an explicit `retry_failed=true` resume (the publisher’s
`--retry-failed` CLI option); integrity
or timeline failures require corrected media and a new draft. A stale predecessor
conflict is surfaced rather than replacing a newer published video.

When `publish=false`, the reviewed bundle remains pending for a later resume.
Dry-run saves only a decision report/summary and never advances durable state.
Private snapshots are retained after failures; logs/checkouts are not archived.
An interrupted run before its checkpoint step cannot guarantee recovery of new
local clips, but the previous remote snapshot remains valid.

## Validation

```sh
python3 -B -m unittest discover -s .agents/skills/release-film/tests
node --test scripts/self-onboarding-publish/publisher.test.mjs
```

Unit tests use fake provider transports and real temporary Git histories, including
whole-utterance v4 dialogue timing, quota circuit breaking and one-scenario/native-language replay. A small
FFmpeg fixture verifies assembly/chapter timing; it is test evidence, never a product
tutorial. Live Claude/ElevenLabs recording, private-store access, deployed Helpdesk
publication, Bunny processing and playback require the configured hosted workflow.
The latest transport and quota fixes have only been tested locally with mocked providers; the recording workflow has not been rerun for these fixes.

Once a scene or translation reports explicit model-quota exhaustion, no more new scene workers or uncached translations are started in that generation attempt. Available English captures can still render with ElevenLabs. A failed metadata translation skips that language and records the reason instead of aborting the whole bundle. Quota status is recorded in the manifest and resets on the next invocation; provider quotas themselves are unchanged.

Tutorial renders forward the configured Mentingo palette into the renderer instead of
using the renderer's generic orange/graphite defaults. Brand settings participate in
the render cache identity, so changed branding rebuilds retained captures without
recording again. Tutorial captions clip provider timing tails to measured audio
duration without a mismatch cutoff and mark those cues in the preparation report.
Cues entirely after the audio are omitted. Malformed timestamps, empty captions,
reversed intervals and unusable overlaps still fail that render. Release-film's
existing 1 ms tolerance is unchanged. The Actions summary reports included/expected
chapter counts per language, so a partial video is visible even when skips are nonfatal.

The full-viewport render profile retains every edge of the recorded page; the removed clock-strip crop
is not used for CDP recordings. It invalidates earlier clipped video segments while retaining portable
captures, translations and paid narration, so the correction does not require authoring scenes again.
