# Self-onboarding workflow

The Helpdesk branch adds a version-triggered recording/publishing path alongside the
existing release recap. It creates one feature-area video per language, composed of
independent complete flows. It does not run on GitHub Release publication.

## Triggers and inputs

`self-onboarding-on-version.yml` queues `self-onboarding.yml` on the repository's
trusted default branch when a `vX.Y.Z` version tag is pushed (prerelease suffixes are
supported). Both workflow files must first exist on the appropriate branch/tag.
Manual dispatch accepts an exact version tag, domains, languages, force, dry-run,
publish and resume-publication. Empty domains means all reviewed domains. English and Polish are the default automatic batch, sharing one raw capture per flow.
GitHub suppresses ordinary push-trigger chaining from tags created with its default
workflow token; a version-creation workflow using that token should dispatch the
Helpdesk workflow explicitly, using the same exact tag/default-branch contract.

Production generation/publication uses the default branch. This standalone Helpdesk
workflow uses the existing `release-film` environment to access its already configured
Claude Code subscription token; it does not modify the release-film workflow.
`helpdesk-publishing` keeps its separate publishing token. Manual dispatch defaults to publication
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

Add `-F dry_run=true` for coverage/impact analysis without recording. The source is
the selected workflow branch commit by default; `target_ref` can select another Git
ref (for a remote branch use `origin/<branch>`) or exact commit. No version tag is
needed. An internal test version labels the artifacts and the publisher rejects
their `testMode` marker. `registration_only=true` checks dispatch without model calls
or credentials. The GitHub UI's Run workflow button may still require the file on
the default branch; use the CLI for this pre-merge test.

The selected spec must be an exact registered `docs/specs/*.md` path, not a glob.
It selects complete feature video(s) whose declared sources include that spec; it
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
Text-to-Dialogue WebSocket endpoint and aligned PCM audio; it does not pass a v4 model
to the legacy REST endpoint. The pinned transport dependency runs in a dedicated
CI Python venv. Registration-only jobs use no environment or provider credentials.

Fresh test state needs no S3 or Helpdesk/Bunny/OpenAI publishing credentials. The
workflow skips private production-cache restore/checkpoint and publication. After
redaction it uploads only videos, captions, posters, timeline and manifest files as
`self-onboarding-test-videos` (14 days), not publisher state, AI logs or checkout files.
Download the artifact from the Actions run to inspect the MP4 and chapters. A failed
required flow remains a failed test; partial content is not advertised as a complete
feature guide. No paid/hosted test was started during this code change.

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
`.agents/skills/release-film/projects/mentingo-helpdesk.json`. Its initial coverage
is 20 development-path flows, 24 authoring flows and 15 learning flows. Business
specifications define scope; target-version implementation and deterministic test
helpers must establish the real flow. Existing fixture gaps or unavailable external
features fail a required flow; they are never replaced with fake API responses or
quietly omitted from the video.

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

Each selected flow is filmed, narrated and visually checked independently with the
existing release-film harness. Every required action/result must pass coverage
review. Release framing, chapter-dropping, total-word budgets and recap duration
limits do not govern tutorial selection. Stable flow IDs survive assembly/reordering.
The browser records one canonical application flow. Shared raw footage and action
pins are reused across EN/PL; each language gets its own localized title, narration,
short overlay labels and captions, spoken by the same ElevenLabs voice. Each localized
render has its own final chapter timings because speech durations differ. The captured
application UI stays as filmed; it is not falsely presented as a separately localized
application session. Localized copy must preserve every action pin and observed result.
Feature titles/descriptions are localized as well. Voice timing and existing
pronunciation rules feed the existing MP3/SRT montage contract.

Shared raw capture bundles and localized segments, audio, captions, transcripts and
checksums are retained across versions. Adding another language reuses the raw
capture and renders that language without running the browser again. Unchanged flows skip camera and voice. Changed domains concatenate their
current segments, decode-check the result and calculate all chapter offsets again
from measured media duration. An unchanged domain skips assembly/upload. Changing
model/settings rebuilds the selected localized segments from retained raw footage.
Removing a video's saved voice ID from the pool randomly assigns a remaining voice
and regenerates all selected languages' narration, keeping each video's chapters
consistent. Adding/reordering pool entries does not change a retained narrator.

Current Helpdesk DTOs accept prerequisites in chapter descriptions. Typed
chapter-level audience/feature filtering is a separate service contract change;
this workflow does not claim to enforce those restrictions in search.

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
node --test scripts/helpdesk-publish/publisher.test.mjs
```

Unit tests use fake provider transports and real temporary Git histories, including
v4 streaming/alignment and one-capture/two-language generation. A small
FFmpeg fixture verifies assembly/chapter timing; it is test evidence, never a product
tutorial. Live Claude/ElevenLabs recording, private-store access, deployed Helpdesk
publication, Bunny processing and playback require the configured hosted workflow.
They have not been executed by this implementation.
