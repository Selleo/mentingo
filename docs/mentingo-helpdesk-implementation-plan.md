# Mentingo Helpdesk Core integration plan

Status: SDK retrieval, Core UI and MCP/assistant integration implemented, 2026-10-28. Version-triggered flow generation, ElevenLabs narration and the trusted publishing workflow are implemented; provider-backed production validation remains pending. This document covers changes in Mentingo Core only.

## Ownership

The separate Helpdesk app lives at `mentingo-plugins/apps/helpdesk`. Its implementation plan is `mentingo-plugins/docs/specs/helpdesk-app-implementation-plan.md`. That repository owns the service architecture, middleware, persistence, indexing, credentials implementation and deployment. Core consumes its versioned API contract and does not reproduce those implementation details here.

Helpdesk is public product guidance for hosted and self-hosted Mentingo installations. Core supplies business-spec-driven tutorial content and consumes searchable published video/chapter references. No installation maintains a help index or embedding pipeline. The proposed external URL is `help.mentingo.com`, configurable/disableable by installation operators.

## Product taxonomy and content generation

Domain means a Mentingo product area, not a hostname or language. Language is an independent field. Start with:

| Domain              | Audiences                    | Spec sources                                                                                                                                  |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `development-paths` | Learner, administrator       | `docs/specs/learning-paths-business-spec.md`                                                                                                  |
| `course-authoring`  | Course author, administrator | `docs/specs/course-authoring-business-spec.md`, `course-authoring-management-business-spec.md`, `course-overview-management-business-spec.md` |
| `course-learning`   | Learner                      | `docs/specs/lesson-delivery-learning-mode-business-spec.md`, `course-enrollment-business-spec.md`                                             |

Add a version-controlled tutorial registry in Mentingo. Each entry declares a stable tutorial key, domain, audience, stable page keys, source specs and headings, watched code paths, tasks demonstrated, relevant feature flags, and desired language variants. Use existing Mentingo supported-language values; only advertise languages with actual recordings. Generate English and Polish from one shared capture by default. Configure two female and two male ElevenLabs voice IDs and `eleven_v4_turbo`. Randomly assign one narrator per feature video and retain that choice across chapters, languages, retries and updates while the voice remains in the configured pool. Localize narration, overlays, captions and public metadata independently and derive timestamps per rendered language.

One video per feature area and language contains its complete set of explicit flows. Stable video keys are `development-paths.guide`, `course-authoring.guide` and `course-learning.guide`. Flows such as create, edit, delete, assignment and import/export are independently reusable segments and searchable chapters. The reviewed registry currently contains 58 flows derived from business specs.

Generation reads the business specs at the exact target release commit, then verifies the described behavior against the application and deterministic demo data. Specs describe intended behavior but do not prove a recorded interaction succeeded. Record synthetic users/courses only. Do not publish internal specs, prompts, logs, or customer data as public tutorial text.

Version-tag pushes queue the trusted workflow without requiring a GitHub Release. Changed specs, watched implementation paths and shared navigation select candidates for semantic flow comparison, not automatic rerecording. The last checked commit of each flow is the baseline. Evidence-backed unchanged decisions reuse clips; newly documented flows and explicitly retired flows are applied as source-bounded data contracts and rechecked for complete coverage. Uncertainty blocks generation with a decision report. Manual dispatch selects domains, languages, version, dry-run, forced regeneration and publication resume.

Keep the release-summary film intact. Tutorial mode teaches complete current flows, with no recap framing or chapter-dropping to meet a word/duration budget. Reuse the camera, visual checks, captions and renderer. ElevenLabs narration uses the repository secret `ELEVENLABS_API_KEY` and configured voice IDs/model. Retain immutable segments and narration in private S3-compatible storage so only changed flows are recorded/voiced again; assemble/upload a successor feature video when its contents change.

Carry stable chapter IDs through the story and rendering pipeline. Export actual starts/ends from the final rendered timeline, never planned timings or chapter-array positions. Chapter removal/reordering during review must retain the correct ID mapping. Validate narration/caption alignment and duration after rendering.

## Publishing workflow integration

1. Generate a tutorial artifact containing the video, public title/description, chapters/transcript/captions, stable tutorial and chapter IDs, domain, language, page keys, release compatibility and source provenance.
2. A dedicated trusted publishing job validates artifact origin and checksums, then authenticates to Helpdesk with the GitHub environment secret `GUIDE_PUBLISH_API_KEY`. Keep this credential out of AI recording jobs and untrusted PR execution.
3. Create a draft revision through the Guide SDK using an idempotency key and expected predecessor, prepare its media and poll that operation before requesting upload authorization.
4. Upload bytes to the returned Bunny TUS endpoint using the short-lived grant. Resume interrupted uploads against the same asset; refresh expired authorization through Helpdesk. Core never holds the Bunny library API key.
5. Finalize the revision and poll verification/indexing. Explicitly publish only after finalization succeeds. Emit the public tutorial link only after publication. Surface structured failure/retry state in the workflow summary.
6. For modifications, create a successor revision and upload its assembled video; the current API does not promise cross-revision media reuse. Do not overwrite a published file or assume upload completion means publication.

Keep the existing release-film workflow available. Add filtered tutorial generation and publishing as its own mode/workflow. Reuse existing artifact provenance checks. Exact service endpoint schemas and generated client fixtures are maintained by the Helpdesk app; pin the client to a compatible contract version.

## Required external API contract

Core needs publisher operations for draft creation/update, upload authorization, finalize, polling/retry and optional withdrawal; and public operations for search, domain/topic browsing and tutorial/revision resolution. Helpdesk's OpenAPI is authoritative for exact paths and DTOs.

Publishing payloads carry stable IDs, text, chapter bounds in milliseconds, timestamps aligned to the rendered video, domain/audience/page metadata, language, source release and compatibility. Core sends content, never vectors or database commands.

Search input carries query, selected keyword/hybrid mode, app version, language, page key and optional domain. Results carry tutorial/revision/chapter IDs, title/excerpt, video/poster/caption references, start/end position, matched language, version compatibility and search/degraded mode. Core handles empty results, unavailable compatible versions, explicit language fallback, 429 with Retry-After and retryable service failures.

Core must not silently present tutorials for a newer incompatible UI. Custom/dev builds supply a known base release or display the service's version-unverified status. Authentication to public retrieval does not require a publishing key. Publishing errors include idempotency conflict and stale-revision conflict; retries must preserve the original operation identity rather than creating duplicate revisions.

## Mentingo UI and assistant integration

Put a question-mark Help & tutorials entry in the user dropdown alongside Profile and Audit logs, with a corresponding mobile menu action. Create a stable route-to-help-context registry covering normal pages, custom layouts and learner mode; never send resource IDs from a URL. Initial prioritized topics are development paths, course authoring and course learning; pages without tutorials still offer global search and the assistant.

Reuse `apps/web/app/components/ui/popover.tsx` and existing dialog/sheet primitives. A compact help panel shows “Ask assistant”, a debounced search field and suggested topics. Topic labels describe results and do not act as filters. Search results show title, chapter, duration, language fallback and version status. Opening a result uses a larger player dialog instead of squeezing video into the popover. Seek after the player reports readiness, show chapter controls/captions, and stop playback when closed. Preserve the user's page and unsaved form state; do not autoplay from opening help alone.

Use the Mentingo backend as a thin query relay so existing generated client/auth patterns remain intact: browser -> Mentingo API -> Helpdesk. It derives supported app version and safe page context, forwards only explicit help text/filters, enforces bounded timeouts, and performs no indexing. Do not forward cookies or auth headers. The assistant backend calls the same Helpdesk retrieval API through its actual tool adapter. The new service does not replace Mentingo's assistant.

Add a typed help-video source/reference to assistant results with tutorial/revision/chapter IDs. Clicking resolves and validates the reference before opening the shared video popup at the matching chapter, without navigating away from the conversation. The popup omits the extra segmented bar below the video and uses its chapter list for seeking. Never execute arbitrary deep links or use arbitrary URLs produced by the model. If suggesting “open this page,” resolve a known page key locally and apply normal access checks. If the assistant is unavailable, video search remains usable.

Use TanStack Query and regenerated Mentingo client contracts for relay APIs. No per-installation secrets or search database are introduced. On Helpdesk outage show retry and cached recent topics where available; the rest of Mentingo stays functional. Existing query cache supports transient outages; persistent offline catalogs are out of scope for v1.

## Core implementation slices

- [x] Tutorial registry mapping business specs and implementation paths to domains, tutorial IDs, audiences and page keys.
- [x] Tutorial recording mode and final-timeline export with stable chapter identities, including single-chapter tutorials.
- [x] Typed publishing client, trusted publication job, scoped API-key use, resumable uploads and operation polling.
- [x] Typed retrieval relay using the locally installed Guide SDK, generated Core client, page-context registry and reusable help panel/results/player.
- [x] Existing assistant and MCP read-tool integration with validated video citations and authenticated local tutorial/chapter navigation.
- [x] Business spec update via the Mentingo feature-overview workflow for the delivered retrieval slice.

The plugins app exposes a validated contract before Core publishing/integration is enabled. Develop Core against deterministic service fixtures while that app is being built. Keep rollout gated until one real tutorial per initial domain is published and tested from a hosted and a separate self-hosted Mentingo installation.

## Core validation

- Workflow tests: impacted-domain selection, unchanged-topic reuse, final timestamp mapping after chapter reorder/drop, artifact validation, retries and existing release-film regression coverage.
- Publishing client tests: draft/upload/finalize/poll sequence, interrupted upload resume, expired grant, failed processing, duplicate/stale requests and secret redaction.
- Core API/client checks: generated contracts, permitted context forwarding, bounded timeouts, no forwarded cookies/tokens or tenant records, explicit 429/unavailable responses.
- UI/assistant tests: route/header coverage, learner/admin views, focus and keyboard behavior, preserved unsaved forms, correct chapter seeking, language/version states, unavailable assistant and service outages.
- Use existing Core Jest/Vitest/Playwright conventions and regenerate clients through repo scripts. Real Bunny playback, captions and listening checks are separate from deterministic test evidence.

## Source grounding

Core references: `.github/workflows/release-film.yml`, `release-film-on-release.yml`, `release-film-publish.yml`; `.agents/skills/release-film/scripts/render_demo.py` and `page.py`; business specs listed above; existing web popover, navigation and assistant components. All service implementation and deployment references belong in the plugins companion plan.

## Delivered retrieval integration

Architecture decision: keep the catalog, embeddings and publication lifecycle in the plugins service. Core adds a thin SDK adapter shared by REST and MCP, using existing authentication and generated-client patterns. This slice introduces no Core persistence, worker or permission model; this document records the boundary without adding a separate Core ADR.

The Core branch is based on staging commit `fcbef011f`. The Help & tutorials entry in the user dropdown and mobile menu uses real generated Core requests; local example results and sample footage have been removed. Search, related suggestions, chapter playback and assistant video popups consume validated service metadata. Authenticated `/helpdesk/tutorials/:key?chapter=...` links remain available as direct destinations. Topic labels remain descriptive, without filter chips. All seven current locales are covered.

`HelpdeskModule` provides authenticated search, tutorial lookup and domain metadata. `HelpdeskService` derives the release and enabled feature keys from server state, validates explicit help input and calls the read-only Guide SDK with a five-second timeout. It does not index content, accept publishing keys or forward tenant data. Both `search_helpdesk` and `get_helpdesk_tutorial` are registered for valid MCP actors and the existing native assistant. Their results remain product guidance rather than evidence about tenant content. Canonical citations open the shared video popup inside the assistant, using current compatible metadata and validated chapter IDs. Direct tutorial URLs continue to resolve through the authenticated route.

The plugins repository owns `@mentingo/guide-sdk`, including generated Axios contracts and typed publishing operations. Core currently installs its client-only tarball as a relative `file:` dependency; `vendor/mentingo-guide-sdk.json` pins its source commit and SHA256. See `vendor/README.md` for reproducible replacement steps. Publishing operations are available in the SDK but intentionally excluded from Core's injected client. The generation workflow must use the SDK's explicit prepare-upload, finalize, operation-poll and publish sequence when implemented; finalization success alone does not publish.

Configure the API with `HELPDESK_ENABLED`, `HELPDESK_API_URL` and optional `HELPDESK_APP_VERSION`. Released builds use `apps/api/version.json`; custom/dev builds with `0.0.0` require a known base release override. Local validation uses the separate service on `http://127.0.0.1:3110` and base release `4.25.0` from the worktree's nearest release tag. The local service now loads its ignored `apps/helpdesk/.env`, with a matching ignored copy in the plugins main worktree. Two approved, clearly labelled demo clips have been uploaded through SDK grants, verified/indexed and published. Their chapter labels are illustrative; real tutorial generation remains pending.

Focused backend/MCP/assistant and frontend tests cover this slice. The UI defaults to keyword search and restores the shared Search with AI row for explicit hybrid requests; editing resets to keywords. The selected strategy is validated and forwarded through REST, MCP and the SDK. Rust keyword mode bypasses all embedding and vector work. Live OpenAI indexing/retrieval and Bunny HLS delivery have been checked using the two approved demos. Earlier authenticated smoke checks also cover domains, missing tutorials and session enforcement. Actual model tool selection, browser playback and automated video production remain unverified. See `docs/specs/helpdesk-business-spec.md` for the current workflow and evidence boundaries.

## Version-driven workflow delivery

The implemented commands, secrets, private storage, retry behavior and validation boundaries are documented in `scripts/helpdesk-publish/WORKFLOW.md`. Automatic batches check all reviewed domains; manual domain selection permits a smaller first production run. Production configuration, real complete-flow recordings and hosted playback are pending. Typed chapter-level prerequisite filtering is not part of this workflow slice. EN/PL public metadata, narration and overlays are localized from shared raw footage. Recording uses the existing `release-film` environment token; branch access remains pending PM approval, with no policy changes made.

## Pre-merge manual generation tests

The separate `self-onboarding.yml` dispatch entry accepts `business_spec` and invokes isolated Helpdesk generation on the selected branch. A branch push registers only this Helpdesk workflow before its first manual test; release-film workflows and CI keep their existing entry points. An exact business-spec path selects its complete feature video; a branch/commit can be recorded without creating a version tag. Fresh test state has no production storage access, and publishing is disabled. The redacted MP4, captions and chapter metadata are downloadable run artifacts. Configuration and the exact dispatch command live in `scripts/helpdesk-publish/WORKFLOW.md`.
