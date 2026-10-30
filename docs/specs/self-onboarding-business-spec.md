# Helpdesk Business Spec

## Business Overview

Mentingo users can find product tutorials while staying on their current page, or ask the existing assistant to find guidance for them. A question-mark entry in the user dropdown alongside Profile and Audit logs opens suggested tutorials and search. Matching results can open directly at the relevant chapter in a video.

Core now retrieves published guidance from the separate Helpdesk service through its SDK. The former local examples and sample footage have been removed. Local validation now uses two explicitly labelled demo clips with illustrative flow names and chapter timings. A separate version-triggered workflow now prepares complete feature videos from business-spec-led flows. Real production recordings and hosted publication remain unverified until its provider credentials and private build storage are configured.

## Who Uses It

- Learners find guidance about taking courses and following development paths.
- Course authors find help with creating and editing courses.
- Administrators find guidance about managing development paths and learning workflows.

These are subjects of public product guidance. Viewing a tutorial does not grant access to the corresponding product action or another user's information.

## Feature Functions

- Find suggested tutorials and search their titles, descriptions and chapter content using keyword search, or explicitly choose Search with AI for hybrid retrieval.
- Open a matching chapter directly, seek using the popup chapter list and explore related tutorials.
- Ask the existing assistant to search product help and return clickable tutorial or chapter references.
- Preserve the current page while watching a tutorial in a dialog.
- Show explicit empty, retry, language-fallback and keyword-fallback states.
- Open help from the user dropdown on desktop and the navigation menu on mobile, with translated interface text in all seven supported languages.

## End-User Value

Learners, authors and administrators can reach the relevant step of a product explanation without browsing a long video or leaving their work. Hosted and self-hosted installations share one catalog, so operators do not maintain a separate help index or refresh tutorial data in each installation.

## How It Works

A signed-in user selects Help & tutorials in the user dropdown (or mobile menu), browses suggestions or enters a question, then selects a result. Topic labels describe results rather than filtering the list. Typing runs debounced keyword search. Search with AI explicitly starts hybrid retrieval; Back to keyword search returns to lexical results, and editing the text also resets to keyword mode. Searches include a symbolic page key so the service can prioritize relevant guidance without receiving resource IDs from the current URL. The dialog shows the returned tutorial, chapter list and related suggestions. Popup players use that chapter list for seeking and omit the additional segmented bar beneath the video. A matched chapter opens at its exact timestamp after the player is ready; opening help alone does not start playback.

Results show each video once with a compact title, domain and duration. Matching chapters appear underneath as individual timestamp links, keeping repeated transcript excerpts out of the list. Demo clips use a small translated badge, with clean task titles throughout the help interface.

Ask the assistant closes the popover and opens Mentingo's existing assistant workspace without submitting a message. Its read-only `search_helpdesk` and `get_helpdesk_tutorial` tools use the same retrieval service as the UI. Selecting a returned tutorial or chapter reference opens a video popup while keeping the current conversation and draft in place. The popup resolves current compatible metadata and validates the stable chapter ID before seeking. Related tutorials open inside the same popup; closing it returns focus to the citation. Bookmarkable tutorial URLs remain available for direct visits. Product guidance cannot establish facts about a tenant's courses, learners or lesson content, and does not count as reading that content.

Core selects the installed release and enabled feature keys on the server. The Helpdesk service returns compatible published tutorials, with explicit language fallback when applicable. An unknown development version requires a configured base release. Empty catalogs or unavailable compatible content produce an honest empty state. Service failures show a retry action; a missing tutorial has its own error state. Search mode distinguishes browsing, explicit keyword retrieval, hybrid retrieval and keyword fallback when the user requested hybrid but semantic retrieval could not run. Keyword mode never calls the embedding provider or vector index, even if a matching query embedding is cached.

## Key Technical Context

- The signed-in browser uses generated Core API methods for search, tutorial lookup and domain metadata. `apps/api/src/self-onboarding` uses the read-only surface of `@mentingo/guide-sdk`; the same domain service is injected into MCP and the native assistant tool registry.
- Public guidance needs an authenticated Core session or valid MCP actor, without course-edit permissions. Existing tenant-content permission and OAuth scope checks remain authoritative for other tools. Helpdesk tools do not enable writes or expand access to tenant data.
- Only explicit search text, supported language, safe page/domain metadata, installed version and enabled feature keys leave Core. Core forwards no session cookies, authorization headers, actor identities or tenant records. The assistant is instructed to formulate short product queries rather than include private course text or conversation history.
- Core validates upstream payloads and Bunny CDN references before exposing them to the UI or tools. Assistant citations require an actual Helpdesk tool result, a product-guidance marker and a canonical same-tenant tutorial link.
- Video.js plays returned Bunny HLS URLs directly. Video bytes do not pass through Core or the retrieval SDK. No publishing credential is installed in Core; video production and publishing belong to the trusted workflow and plugins service.
- `HELPDESK_ENABLED`, `HELPDESK_API_URL` and optional `HELPDESK_APP_VERSION` configure retrieval. The default external service URL is `https://help.mentingo.com`; this implementation does not deploy it. The portable SDK artifact and its source commit/checksum are recorded under `vendor/`.

## Test Evidence

Focused backend tests cover server-derived compatibility, bounded requests, SDK failures, safe response projection, invalid and private payloads, and missing or disabled configuration. MCP tests exercise actual HTTP tool calls for student, search, account and authoring scope cases, while preserving existing tenant access gates. Assistant regressions cover canonical tutorial citations and prevent product guidance from satisfying tenant-content reads.

Frontend tests cover generated-client requests, debouncing, cancellation, loading/errors, honest empty states, exact millisecond chapter seeking, language fallback, authenticated deep links and related tutorials. Assistant citation tests verify popup opening without route navigation, retry and missing-chapter states, related-video switching, safe same-tenant URL resolution and focus restoration. A floating-assistant regression checks that closing a tutorial keeps the conversation and unsent draft open. Existing shared player tests cover readiness and keyboard behavior. Deterministic tutorial fixtures remain in tests only.

Local provider validation uploaded both approved demo files directly to Bunny with SDK-issued grants. The Rust service verified the originals and encoding, indexed their labelled metadata with OpenAI, and explicitly published both revisions. Live keyword and hybrid queries returned matching chapters; Bunny HLS manifests and streams were readable with the Mentingo referer. The demo chapter labels are illustrative and are not evidence that the footage teaches those workflows. Earlier authenticated smoke checks also covered session enforcement and missing tutorial errors. No live model choosing the tools, browser playback or narration-quality claim follows from these checks. Automated video generation remains separate work.

## Maintaining Tutorial Videos

A version tag can queue a new tutorial check without publishing a GitHub Release. One feature video contains all its reviewed flows, with stable chapter identities. Business specifications establish the expected tasks and outcomes; browser recordings and their assertions demonstrate the required interactions in the target version using synthetic data. A missing or unsupported required flow blocks the feature video instead of quietly reducing coverage.

Implementation changes identify candidates for comparison. Only an evidence-backed user-flow change requires a new recording; internal refactoring and wording edits can reuse existing clips. Newly documented flows and explicitly removed flows update the planned chapter inventory automatically after source validation and a second complete coverage check. Uncertain decisions produce an explicit review report and stop recording. The workflow retains successful clips across versions, regenerates affected flows with ElevenLabs narration, then assembles the complete feature video with recalculated chapter timestamps.

A separate publishing job streams the assembled video directly to Bunny and uses the Guide SDK to request verification, search indexing and explicit publication. Existing published guidance stays available while a replacement is processing. Interrupted uploads/indexing can resume from private checkpoints without rerecording. The same public catalog continues serving hosted and self-hosted installations.

Source evidence: `self-onboarding-on-version.yml`, `self-onboarding.yml`, the reviewed `mentingo-self-onboarding.json` flow registry, `self_onboarding_catalog.py`, `self_onboarding_recording.py`, and `scripts/self-onboarding-publish/publisher.mjs`. Deterministic tests cover semantic decisions, coverage blocking, private state, SDK publication and FFmpeg chapter assembly. This change has not run the provider-backed recording/publishing workflow. Chapter prerequisites are descriptive metadata until a separate typed Helpdesk search contract supports them.

Maintainers can test a complete feature guide before merging by manually choosing one business specification and a branch or commit. This test creates downloadable video/chapter artifacts using fresh state and a separate testing environment; it does not publish tutorial revisions or advance production build state. Tests cover exact-spec selection, untagged source commits, the standalone Helpdesk manual entry point and rejection of test bundles by the publisher.

Recording attempts retain a downloadable progress artifact even when a later step fails. Maintainers can inspect any available clips, audio, captions, failure screenshots and sanitized startup diagnostics. The artifact clearly marks partial footage as review material, so it is not mistaken for a finished tutorial. Failed runs do not publish incomplete guides; production retries continue to use their private reusable build checkpoints.

Tutorial review gives advisory feedback about the recorded task and narration. It accepts ordinary explanations supported by the flow contract, including rules a still image cannot independently prove. One bounded review records suggestions and possible coverage concerns without rewriting the story, rerecording footage or blocking generation. Reviewer unavailability and malformed answers are recorded as warnings. Browser execution, valid action pins and media validation still determine whether a usable recording was produced. Review findings remain available in progress artifacts and reusable capture bundles; a completed render does not imply that advisory concerns were resolved.

English and Polish variants share one recording of each application flow and the same narrator identity. Each feature video randomly selects a narrator from four configured voices, two female and two male, with equal probability. The saved selection stays consistent across chapters, languages, retries and future versions. Removing its voice from the configured pool chooses a replacement and regenerates the selected languages' narration from retained footage. Narration, overlay labels, captions and feature metadata are localized independently; each MP4 has chapter positions measured against its own audio/video timing. Adding a language or regenerating its voice reuses retained raw footage. The workflow uses Eleven v4 Turbo through its dialogue streaming API. The existing Claude subscription token remains in its GitHub environment. No live provider-backed multilingual recording has been run.
