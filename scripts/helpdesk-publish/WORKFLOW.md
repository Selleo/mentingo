# Helpdesk feature-video workflow

The Helpdesk branch adds a version-triggered recording/publishing path alongside the
existing release recap. It creates one feature-area video per language, composed of
independent complete flows. It does not run on GitHub Release publication.

## Triggers and inputs

`helpdesk-videos-on-version.yml` queues `helpdesk-videos.yml` on the repository's
trusted default branch when a `vX.Y.Z` version tag is pushed (prerelease suffixes are
supported). Both workflow files must first exist on the appropriate branch/tag.
Manual dispatch accepts an exact version tag, domains, languages, force, dry-run,
publish and resume-publication. Empty domains means all reviewed domains. English
is the initial automatic batch; Polish is an explicit language selection.
GitHub suppresses ordinary push-trigger chaining from tags created with its default
workflow token; a version-creation workflow using that token should dispatch the
Helpdesk workflow explicitly, using the same exact tag/default-branch contract.

The feature branch can be reviewed/tested locally. Trusted generation/publication
is intentionally restricted to the default branch; it does not expose production
keys to PR code. The existing `release-film` environment is reused for recording.
Create `helpdesk-publishing` with equivalent default-branch restrictions.

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

| Variable                      | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `GUIDE_API_URL`               | Deployed Helpdesk HTTPS origin, e.g. `https://help.mentingo.com`       |
| `ELEVENLABS_VOICE_ID_EN`      | Chosen English narrator ID                                             |
| `ELEVENLABS_VOICE_ID_PL`      | Required only for Polish batches                                       |
| `ELEVENLABS_MODEL_ID`         | Optional; pinned default `eleven_multilingual_v2`                      |
| `HELPDESK_BUILD_S3_URI`       | Exclusive private prefix, e.g. `s3://private-builds/mentingo-helpdesk` |
| `HELPDESK_BUILD_REGION`       | Optional, defaults `us-east-1`                                         |
| `HELPDESK_BUILD_ENDPOINT_URL` | Optional HTTPS endpoint for existing S3-compatible storage             |

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
is 19 development-path flows, 24 authoring flows and 15 learning flows. Business
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
English/Polish narration uses ElevenLabs alignment timings, existing pronunciation
rules and MP3/SRT contracts. Feature-level titles/descriptions currently use the
registry's English copy; screen language follows the actual app fixture. Polish
narration is not a claim of fully localized screens/catalog metadata.

Completed segments, audio, captions, transcripts and checksums are retained across
versions. Unchanged flows skip camera and voice. Changed domains concatenate their
current segments, decode-check the result and calculate all chapter offsets again
from measured media duration. An unchanged domain skips assembly/upload. Changing
voice/model/settings requires an explicit forced domain rebuild, preventing mixed
unannounced narrator profiles.

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

Unit tests use fake provider transports and real temporary Git histories. A small
FFmpeg fixture verifies assembly/chapter timing; it is test evidence, never a product
tutorial. Live Claude/ElevenLabs recording, private-store access, deployed Helpdesk
publication, Bunny processing and playback require the configured hosted workflow.
They have not been executed by this implementation.
