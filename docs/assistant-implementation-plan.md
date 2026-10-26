# Core assistant implementation

## Scope

V1: a native Mentingo assistant with private user/tenant threads, read-only permission-aware tools, verified source links, durable AI SDK Workflow execution, Langfuse traces, and administrative AI Conversations visibility. Existing course-generation checkout remains untouched.

V2 boundaries: structured message parts and run events support contextual mini-chat and live artifacts later. V1 does not expose writes, report-filter actions, or artifact editing.

## Ownership and order

1. Runtime worker (GPT-6.1 Sol high): validate actual Workflow packages and self-hosted Nest integration; implement runtime/build and dependency integration.
2. Backend worker (GPT-6.1 Sol high): storage, API contracts, native authorized read-tool execution, grounding, and focused tests.
3. Root: UI design and implementation using existing theme/components, generated client integration, review, integration validation.
4. Bounded follow-up worker (GPT-6.1 Sol medium): admin conversation integration, translations or focused validation once contracts settle.

## Product decisions

- The AI sidebar section groups AI Assistant and administrative AI Conversations; each destination retains its own permission gate.
- The conversation uses an open canvas, compact composer and right-side history drawer on desktop/mobile, following the supplied dashboard screenshots and Blueprint AssistantConversation/AssistantComposer. No permanent secondary sidebar. Future artifact layout remains deferred.
- History is reloadable; sends have stable request identities; failures and cancellation are visible.
- Source links are generated from authorized tool evidence. Thread access never grants access to new content.
- Core owns conversations, run identity, permission rules and UI contracts. Workflow owns execution state.

## Verification

- Focused API tests: ownership, tenant isolation, read-only tool enforcement, request deduplication, cancellation and source validation.
- Workflow build/runtime smoke and persistence/recovery where available.
- Generated Swagger/client via existing tooling; API and web type/lint checks.
- UI component tests for thread switching, composer, errors, sources, and retry/reload behavior.
- Browser validation where local services permit; distinguish it from provider, database, deployment and Langfuse ingestion validation.
- Business spec under docs/specs with truthful implementation and test evidence.

## Progress

- Isolated branch/worktree created from ecca45bb9.
- Implemented persistent user/tenant threads, authenticated read tools, grounding, cancellation, recovery and admin AI Conversations integration.
- Implemented AI SDK Workflow with self-hosted Postgres World and shared Langfuse trace identity; Workflow requires its own database.
- Implemented responsive Assistant UI, localized copy, retry handling, history and verified source links.
- API lint/typechecks and web lint/typechecks passed. Focused API/OAuth tests, 15 database-backed HTTP tests, and 45 web tests passed.
- Deterministic Workflow execution passed with real disposable Postgres; partial response checkpoints and continuous trace identity verified locally.
- Desktop/mobile UI fixture inspected. Authenticated Hangar login, Assistant page, availability and thread history verified. Fixed boolean query parsing with six HTTP regressions. Full provider calls and remote Langfuse ingestion remain unverified.
- Web production build passed on retry with Sentry upload disabled. Initial build hit a transient static-copy/SPA output race (ENOENT in build/server); no build configuration change was needed.
- Worktree registered and running in Hangar, with isolated demo data and an initially separate Workflow database. The current deployment layout uses isolated SDK schemas in Core, protected by the pinned migration patch; see `assistant-runtime.md`. Main-checkout configuration remains unchanged. Canonical URL ownership can change independently; use the worktree preview to verify this branch.

## UI revision (2026-10-23)

- Reworked layout against the supplied dashboard screenshots and Blueprint assistant source: open canvas, right-side conversation history, compact composer using the standard rounded-lg corners, restrained empty state and message typography.
- Grouped AI Assistant and AI Conversations under AI, preserving separate permission gates.
- Verified authenticated page and history reads, desktop/mobile layouts, and light/dark Assistant styling; no mobile horizontal overflow.
- Nine Assistant tests and 23 navigation tests passed. Full web typecheck/lint passed with one unrelated existing warning.

- Follow-up design refinement: distinct bot/conversation icons, standard Mentingo corner radii, page background separated from navigation, and no redundant visible page title.

## Composer and card refinement

- Main conversation is an inset card using the same background surface as navigation, within the existing page background.
- Composer follows course generation and AI Mentor controls and spacing, using existing transcription transport and recording visualization.
- Dictation appends to a reviewable draft; stop/cancel and asynchronous transcription states prevent accidental submission. Oversized drafts remain editable.

## Layout and transcript refinement

- Page heading sits above the full-width card; New conversation and history controls align inside the card with equal padding. Flex layout fits the available viewport with no page scroll; only the message region scrolls.
- History has explicit Active/Archived tabs and no duplicate new-conversation action. Rename/archive menu removed from the conversation UI.
- Transcript reuses AI Mentor ChatMessage and ChatLoader, preserving Assistant verified-link filtering and failure status. Suggestions are left-aligned beneath the greeting.
- 31 focused tests and full web typecheck/lint passed (one existing unrelated lint warning). Authenticated viewport checks at1920,1680,1440,1280 and390px widths found no page/document scroll.

## Runtime serialization fix

- Native MCP tool schemas are exported as plain JSON at the Workflow boundary; TypeBox symbolic metadata previously prevented durable context serialization before model execution. OAuth validation continues using the original schemas.
- The Workflow smoke now uses the actual native tool catalog. It completed with deterministic model/tool steps, partial checkpoints and trace correlation. 51 native/OAuth regressions passed; live provider generation remains unverified. Existing failed runs remain failed; a new send uses the repaired path.

## Workflow clock regression

- A subsequent real run exposed a second failure: hashing all ULID bits gave the Workflow VM a future clock and overflowed the model timeout before any provider call.
- Run IDs now embed the persisted Core run creation timestamp in the ULID timestamp field and hash only the identity portion. The two-minute generation timeout remains enabled.
- The smoke test now starts through the production deterministic-ID hook and asserts the embedded timestamp; the old implementation reproduced the exact RangeError before the fix.

## Conversational outcome repair

- A real greeting ("hej co tam") reached the model but was incorrectly labeled as a factual answer and rejected without a read. Conversational replies now have an explicit conversation kind.
- Final proposals are validated as durable steps. Rejected proposals return model-readable feedback; they do not stop the agent or publish unsupported text. The existing eight-step bound and factual/readable evidence rules remain.
- Compiled Workflow regressions verify the exact greeting repairs to a completed conversation with zero reads, and eight unsupported factual proposals stay hidden and fail with a bounded validation outcome. The grounded/tool/stream/trace/run-ID smoke also passes.

## Persona and execution activity

- Local assistant instructions follow the Slackbot’s concise, natural, helpful style, without forced slang. The latest user message determines reply language, with interface-language fallback for ambiguous greetings. Signed-in user permissions and verified evidence govern all factual answers.
- Persisted run.activity drives starting/thinking/searching/reading/writing labels. Handoff starts immediately in the UI; runtime activity follows actual authorized work rather than a timer. Terminal states clear progress.
- The shared AI Mentor loader renders an optional activity as one readable inline spinner and label; other consumers retain their existing loading presentation. The stop action matches the filled square control used by course generation.

- Validation:26 focused web tests,35 backend progress tests,3 compiled Workflow fixture scenarios, and full web lint/typecheck passed. Visual fixture checks covered all five phases and mobile overflow; no live model request was made for persona evaluation.

## Send ordering and response presentation

- Sending immediately renders the user message before the starting indicator and clears the composer. Persisted messages replace optimistic messages by clientMessageId, preserving distinct repeated text and retry identity.
- New-thread responses seed an absent transcript cache with the saved user/assistant pair; existing streamed caches are preserved. Equal-timestamp database rows consistently place user messages before assistant messages.
- Native management course results include canonical links, allowing the existing evidence collector to expose verified references without changing OAuth output.
- Validation:31 focused frontend tests,13 native/OAuth/source-link tests,2 HTTP/database ordering cases and3 compiled Workflow fixtures passed. Full API/web lint and typechecks passed (one unrelated existing web lint warning). Authenticated read-only preview and five activity states were checked, including mobile overflow. Provider behavior was not evaluated with a live model request.

## Linked records and universal authenticated access

- Make Assistant available to every active authenticated user, including custom roles, while retaining domain read permissions, learner assignment/published-content rules, tenant boundaries and private thread ownership. AI Conversations oversight keeps its separate permission.
- Include canonical links for people and other supported read entities only when a usable, authorized UI destination exists. Keep OAuth tool output compatible.
- Add optional record type and sanitized description to source metadata. Display only references actually used in the answer rather than every search result.
- Render a compact interactive Mentingo-style hover/focus preview for inline and reference links using saved authorized metadata. No preview HTTP request, provider call or remote image request is needed. Historical answers and previews remain saved conversation content; destination access is checked by its existing page/API.

- Preview cards remain open while moving from a reference to its action, survive transcript polling, and support keyboard focus/Escape. Both the reference and Open in Mentingo action use internal React routing in the same tab.

- Verification:69 focused frontend tests,52 focused backend tests,6 HTTP/database cases and3 compiled Workflow fixtures passed. Full web/API typecheck and lint passed with one unrelated existing web lint warning. Browser fixture confirms the pointer can move into the preview and its footer navigates through React without a document navigation; dark and narrow layouts were inspected. No live provider call was made.

## Reading references and conversation resume

- Keep every verified link available inline, but omit people, groups and categories from the separate Sources list. Preserve reading references such as courses, lessons, articles and resources, including older messages without typed metadata.
- Remember the selected nonarchived thread in sessionStorage scoped to the signed-in account. On entering the Assistant landing route, validate the saved thread before restoring it. An explicit New conversation clears the selection; no message is automatically sent or generation restarted.

- Validation:24 page integration cases cover scoped restore, new-chat override, archive/deletion, cached denial, transient errors, unavailable/quota-limited storage and account changes during a request.8 message-view tests cover source presentation and stable previews. Full web typecheck/lint passed with one unrelated existing lint warning. Browser fixture confirmed remember→restore and New→reload stays blank, without model calls.54 focused MCP access tests were also rerun successfully.

## Floating conversation

- Extract the existing AssistantConversation for full and compact surfaces, preserving native API authorization, message polling, send retry IDs, stop, transcription and source previews. Compact sends keep the current page; full-screen handoff opens the same thread with its draft.
- Mount the dock once in the shared authenticated navigation shell and scope all state to the session actor. Validate the selected thread before showing it, hide on Assistant, and react to same-tab selection changes.
- Use pointer capture for mouse/touch dragging, six-pixel click/drag separation, visual-viewport bounds, edge settling with reduced-motion support and a bottom close target. Arrow keys move the bubble, Delete hides it, and the panel header offers only full-screen and minimize actions.
- Bubble dismissal stores a separate UI preference and never removes the selected thread, archives a conversation, cancels generation or calls a mutation. Visiting the full Assistant re-enables the bubble for a later departure.

- Sidebar presentation uses the shared admin role slug: admin and mixed admin roles keep the AI group; learners, creators and other non-admins get standalone Assistant. Administrative conversation access remains permission-controlled, including standalone oversight access for custom non-admin roles.

- Verification:86 Assistant/dashboard/authentication tests and56 role-specific navigation tests passed, plus9 focused dock/bounds cases after the pointer interruption adjustment. Browser checks with deterministic data covered pointer capture, edge settling, drop dismissal retaining the selected session, fullscreen draft handoff, mobile bounds and dark mode. A read-only authenticated check against an existing tenant1 conversation opened the real compact panel and returned to the same full-screen thread without errors. No model request was sent.

- Persist bubble position and expanded/minimized state in actor-scoped sessionStorage so changes between public-content, user, admin and lesson layouts do not reset it. The shared NavigationWrapper hosts one dock across all authenticated product pages. Use solid token colors for the idle close target (alpha modifiers on hexadecimal CSS variables were transparent); retain red color and scale feedback only during drag-over.

- Refine the close target to a subtle solid light/gray circle (dark-theme equivalent), without a gradient or visible caption. It turns red and scales only during drag-over. New sessions place the bubble at bottom-right; user-chosen positions and open/minimized state remain persisted across navigation and remounts. Remove the duplicate card-header X; drag-to-dismiss and Delete remain available.
