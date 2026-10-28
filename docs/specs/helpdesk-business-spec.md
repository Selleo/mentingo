# Helpdesk Business Spec

## Business Overview

Mentingo users can find product tutorials while staying on their current page, or ask the existing assistant to find guidance for them. A question-mark entry in the user dropdown alongside Profile and Audit logs opens suggested tutorials and search. Matching results can open directly at the relevant chapter in a video.

Core now retrieves published guidance from the separate Helpdesk service through its SDK. The former local examples and sample footage have been removed. The local service currently has an empty catalog; creating and publishing real Mentingo recordings is the next delivery slice.

## Who Uses It

- Learners find guidance about taking courses and following development paths.
- Course authors find help with creating and editing courses.
- Administrators find guidance about managing development paths and learning workflows.

These are subjects of public product guidance. Viewing a tutorial does not grant access to the corresponding product action or another user's information.

## Feature Functions

- Find suggested tutorials or search their titles, descriptions and chapter content through the shared Helpdesk catalog.
- Open a matching chapter directly, seek using chapter controls and a segmented timeline, and explore related tutorials.
- Ask the existing assistant to search product help and return clickable tutorial or chapter references.
- Preserve the current page while watching a tutorial in a dialog.
- Show explicit empty, retry, language-fallback and keyword-fallback states.
- Open help from the user dropdown on desktop and the navigation menu on mobile, with translated interface text in all seven supported languages.

## End-User Value

Learners, authors and administrators can reach the relevant step of a product explanation without browsing a long video or leaving their work. Hosted and self-hosted installations share one catalog, so operators do not maintain a separate help index or refresh tutorial data in each installation.

## How It Works

A signed-in user selects Help & tutorials in the user dropdown (or mobile menu), browses suggestions or enters a question, then selects a result. Topic labels describe results rather than filtering the list. Searches are debounced and include a symbolic page key so the service can prioritize relevant guidance without receiving resource IDs from the current URL. The dialog shows the returned tutorial, chapter timeline and related suggestions. A matched chapter opens at its exact timestamp after the player is ready; opening help alone does not start playback.

Ask the assistant closes the popover and opens Mentingo's existing assistant workspace without submitting a message. Its read-only `search_helpdesk` and `get_helpdesk_tutorial` tools use the same retrieval service as the UI. Returned references open an authenticated local tutorial page, optionally at a stable chapter ID. That page resolves current compatible metadata and validates the chapter before seeking. Product guidance cannot establish facts about a tenant's courses, learners or lesson content, and does not count as reading that content.

Core selects the installed release and enabled feature keys on the server. The Helpdesk service returns compatible published tutorials, with explicit language fallback when applicable. An unknown development version requires a configured base release. Empty catalogs or unavailable compatible content produce an honest empty state. Service failures show a retry action; a missing tutorial has its own error state. Search mode distinguishes browsing, hybrid retrieval and keyword fallback. The local service runs without an embedding provider, so nonempty searches currently report keyword fallback.

## Key Technical Context

- The signed-in browser uses generated Core API methods for search, tutorial lookup and domain metadata. `apps/api/src/helpdesk` uses the read-only surface of `@mentingo/guide-sdk`; the same domain service is injected into MCP and the native assistant tool registry.
- Public guidance needs an authenticated Core session or valid MCP actor, without course-edit permissions. Existing tenant-content permission and OAuth scope checks remain authoritative for other tools. Helpdesk tools do not enable writes or expand access to tenant data.
- Only explicit search text, supported language, safe page/domain metadata, installed version and enabled feature keys leave Core. Core forwards no session cookies, authorization headers, actor identities or tenant records. The assistant is instructed to formulate short product queries rather than include private course text or conversation history.
- Core validates upstream payloads and Bunny CDN references before exposing them to the UI or tools. Assistant citations require an actual Helpdesk tool result, a product-guidance marker and a canonical same-tenant tutorial link.
- Video.js plays returned Bunny HLS URLs directly. Video bytes do not pass through Core or the retrieval SDK. No publishing credential is installed in Core; video production and publishing belong to the trusted workflow and plugins service.
- `HELPDESK_ENABLED`, `HELPDESK_API_URL` and optional `HELPDESK_APP_VERSION` configure retrieval. The default external service URL is `https://help.mentingo.com`; this implementation does not deploy it. The portable SDK artifact and its source commit/checksum are recorded under `vendor/`.

## Test Evidence

Focused backend tests cover server-derived compatibility, bounded requests, SDK failures, safe response projection, invalid and private payloads, and missing or disabled configuration. MCP tests exercise actual HTTP tool calls for student, search, account and authoring scope cases, while preserving existing tenant access gates. Assistant regressions cover canonical tutorial citations and prevent product guidance from satisfying tenant-content reads.

Frontend tests cover generated-client requests, debouncing, cancellation, loading/errors, honest empty states, exact millisecond chapter seeking, language fallback, authenticated deep links and related tutorials. Existing shared player tests cover readiness and keyboard behavior. Deterministic tutorial fixtures remain in tests only.

An authenticated smoke check against the running isolated Core branch reached the local Rust service through the installed SDK: domain browsing returned all three domains, empty browsing returned an empty catalog, a nonempty search returned keyword fallback, a missing tutorial returned 404, and unsigned Core requests returned 401. This is real local integration evidence with an empty catalog. It does not establish live semantic retrieval, real Bunny playback, narration quality or a live model choosing the new tools. Video generation and provider validation remain separate work.
