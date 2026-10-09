# AI course generation

## Business Overview

Course authors describe the course material or changes they need in AI course generation, then review the proposed result before it reaches the course. The interface is being simplified to one text-led interaction with a single plus menu for sources, curriculum scope, and AI behavior, replacing the earlier three-column workspace. Saved requests and results remain available after navigation or a live-update interruption.

## Who Uses It

- Editors with access to a particular course and AI-generation permission prepare new lessons or targeted revisions for that course.

## Feature Functions

- Type or dictate a generation or editing request, with target scope, a Fast/Balanced/Thorough thinking control when Mentingo's own AI provider is active, and explicit source/research permissions.
- Use the selected thinking effort for the first route and generation attempt as well as later retries when Mentingo's own AI provider is active.
- Attach approved files from the composer, recover completed unsent attachments after a reload, and keep sent source chips on the exact request that used them. Send stays unavailable until every selected file has finished processing with usable text; the connected AI service also rejects a request that reaches it before processing finishes or without usable extracted text.
- When a generated AI Mentor lesson uses approved company files, attach prepared lesson documents at application so its learner conversations can retrieve relevant company context.
- Continue an existing conversation with a focused revision request, keeping the approved brief and outline while using only the selected lessons' current details.
- Revise selected lesson blocks or quiz questions while preserving content outside the requested scope.
- Follow generated outlines, saved assistant responses, reviewable results and author questions in one interaction. Actual task status stays visible, while the suggested plan is separate from completion progress. Outline-only proposals say **Review outline** and **Approve outline**; approval starts lesson writing, returns the author to the conversation, and does not claim to apply course changes. A later review remains available after an earlier application has finished.
- Before an outline is drafted, check whether the allowed material supports the requested learning objectives and assessments. If product-specific facts are missing, ask the author for reliable source material or web research at that stage; a source catalog or general-knowledge permission alone does not justify a product quiz.
- Provide public page links in the request and let the assistant read them directly when web research is enabled. Page extraction uses the supplied links without requiring a search first; fetched text remains evidence to assess rather than instructions to follow.
- See the actual topic-specific search queries beneath conversation search activity. Searches use the request and selected course topics, and follow-up queries address identified evidence gaps.
- See web sources the assistant used as compact favicon chips; opening one shows the page title, description, address and an **Open source** link, fetched on demand through a guarded link-preview endpoint.
- See a short plan of two to six concrete actions, such as researching the subject, preparing an outline, creating chapters, and writing lessons when those actions fit the request. The plan appears with the assistant's initial response before its live work, and earlier updates remain visible as work continues. Private model reasoning is not displayed.
- Return to recent conversation turns immediately and load earlier messages on demand without losing the current draft or review state.
- Read requests, assistant updates, questions, task activity, and proposals in durable chronological order. When an earlier request produces a later result, that result appears below any intervening messages while retaining its link to the original request.
- Answer durable clarification and permission questions in the assistant turn where they arise; web-search permission uses compact, visibly clickable **Allow** and **Deny** actions and is saved with the session.
- Review one generation request as a single course-change group once actual changes exist, even when the request writes several lessons in separate tasks. The chat card summarizes the combined changes with their targets and statuses and offers one **Review changes** action; completed changes become reviewable and can be applied once generation in that request has finished or failed with saved work. Pending lessons, queued assets and dependencies in that same request keep review unavailable; generation in another request does not block the saved results. Changes are included by default, can be excluded individually in curriculum review mode, and selected ready changes are applied together. Real prerequisite changes and required assets must still be available; failed sibling work remains visible for separate recovery.
- Keep the active response indicator below completed messages and work in the conversation. Saved plans and tool activity explain visible progress; private model reasoning is not exposed.
- Keep a named product or organization in the resolved course brief and every authored lesson. Permitted web research informs both the outline and individual lessons; an empty search tries a small number of alternate queries. Previously fetched session research can be selected as durable evidence for a later request. Natural practice scenarios are allowed alongside researched factual material without an extra content-mode selection. Scenario provenance and generation concerns stay in creator quality notes or pre-generation questions, rather than learner-facing labels or quiz questions. These examples do not count as evidence or authorize invented product behavior.
- Inspect the completed draft before review opens, then write one change request for the whole iteration. Submitting it appears as a new user message in the conversation, closes the prior draft's review action, and starts a revised draft that becomes reviewable only after its work finishes.
- Review fill-in-the-blanks questions with visible answer placements and word choices. The read-only preview keeps the original colors and omits drag handles, removal buttons, and other editing controls.
- Edits require at least one valid course operation before they can become a reviewable proposal. Ambiguous target scope must be resolved before writing; an empty edit is invalid rather than a course change.
- Stop active generation from the composer while keeping Send available for a new request. When a step fails, see whether it needs a fresh draft, a provider retry, an author answer, or a service fix. Retry failed parts while preserving completed chapter plans, research and author approvals.
- Generate visuals with OpenAI GPT Image Sunburst. The authoring agent selects standard quality for ordinary visuals and premium quality when additional detail improves learning. Explicitly approve uncertain generation retries and omit optional visuals from an application when appropriate. Public-web image import is outside this authoring scope.
- Provider usage is recorded for operational accounting; it is not displayed in the authoring interaction.

The conversation treats internal execution records as background state, not missing chat
messages. If a saved display record arrives incomplete, the workspace fetches a fresh
session snapshot automatically instead of asking the author to reload the page.

The source policy supports explicit web/general authority and persisted section constraints for
backend processing. Uploading a file adds its returned source version to the current session
evidence policy while processing continues. The author can keep writing a request, but cannot
send it until every attached file finishes processing; a failed attachment must be removed.
File upload and source-ingestion work do not count as
assistant response work: they do not show a pending assistant response or replace Send with Stop.
A durable source inventory record supplies the filename, source version ID, and processing status.
The composer tracks that status before Send for both new attachments and sources selected earlier; only completed files with usable text can be sent, and the connected AI service checks readiness again when the request is created. The sent request retains the file on its own turn. The drawer presents a flat source list with
status and a session-only remove action; per-file selection and inline section trees are not exposed.
Processing updates change the displayed attachment status as they arrive, without a page refresh. The plus menu calls the curriculum selector **Scope of changes**.
Replacement mapping and detailed section review remain separate backend or review surfaces.
When a selected source is refreshed, the service reports which lesson tasks its sections affect.
When replacement mapping is needed, the drawer shows affected lesson titles and preselects tasks
that are eligible for regeneration; the author can adjust that selection before applying the
explicit mapping. Tasks made eligible by resolving the displayed section mappings become
selectable. Only selected lesson tasks are queued against the replacement source. Existing
proposals and unselected task evidence remain frozen.
Authors can upload a source through the authenticated multipart endpoint, follow its processing
task, and restore the latest saved source policy after reconnecting. These capabilities are
implemented on the feature branch; the complete authoring workflow has not been released or
verified through authenticated browser end-to-end tests.

Durable author questions appear inside their owning assistant response, at the ordered question
part when available, and are shown only once. New review proposals and questions appear in that
open conversation as soon as their ordered event arrives; authors do not need to reload the page.
General questions offer a compact answer action. After answering, the clarification keeps the
author's response visible in that same turn after reload and removes the answer input. Web-search
consent shows a short localized request with Allow and Deny actions and retains an answered state;
the durable reason remains available to the agent without adding prose to the chat control. A
saved web-search grant resolves its pending prompt after reload, and a task that has already
finished does not show an unusable permission prompt. For a web-search
permission request, allowing first submits the durable `question.answer` command so a fresh session
can resume even before it has a saved source policy. The UI then saves `webEnabled` for future
requests, starting from the fresh-session policy if needed; denying does not change source policy.
The Core UI expects a durable question record with `capability: "web_search"` and an optional reason.
Focused projection and transcript tests cover this contract, but Luma emission and a live backend
resume after consent remain unverified.

For each request the chat shows one change card with a single truthful state: changes ready (Review changes / Discard), course outline ready (Review outline), outline approved while lessons are written, approved but not applied yet (Review and apply), applying, applied, could not apply (Try again), course changed in the meantime, or discarded. "Approved" never reads as "applied": a change counts as applied only after Core confirms the durable receipt. The card lists up to four changes with the same New / Edited / Moved / Removed labels as review mode; each row opens review mode on that change. Applying, approving an outline or discarding from review mode confirms the outcome with a toast before the curriculum refreshes.

Metadata-only changes, such as a course title or settings, appear in review mode as a **Course details** entry above the chapters with the current and proposed values. Decisions emit a status update immediately, and the saved turn includes their decision records, so accepted, rejected, and applied states remain correct after reconnecting.

## End-User Value

An outline-only proposal uses **Accept** to continue generating its lessons. It contains no course operations, so accepting it does not submit a native course application. Generated chapter, lesson, and edit proposals use **Apply**; those are reported as applied only after Core confirms the receipt.

The intended result is faster course preparation and revision with clear review of what changes, without regenerating unrelated content.

Preview and Apply use the same final-order planner. Multiple requested positions are resolved together, unaffected siblings retain their relative order, and explicit reorders use their target chapter. After partial Apply, preview uses committed application mappings rather than temporary draft IDs. Authoring positions start at zero; native curriculum positions start at one.

Only one uncompleted export can be frozen per session. Repeating its original selection resumes that export. A permanent or exhausted Apply failure has a durable terminal receipt, allowing an explicit retry to freeze a new export without replaying failed work. Unresolved preview dependencies show an actionable message instead of an invented order.

Curriculum chapter labels follow the visible list order. Native chapter moves repair older order gaps before applying a position and bound the requested position to the current chapter count, so generated chapter placement cannot leave a visible sequence such as 1, 3, 4.

Public research derives its topic from immutable author requests and explicitly accepted outline topics. A model that reads private source passages has no public search tool. Source text and generated feedback cannot grant permissions or expand edit scope. Generated HTML is validated before Apply, and review does not automatically load newly invented media URLs; existing course media and authorized asset previews remain available.

## How It Works

Authors start from an existing course and open the single visible **AI course generation** workspace entry from Curriculum. Opening is idempotent for the course, so returning to the route restores the active server session. The text composer can address selected chapters, lessons and blocks or the whole course. A follow-up such as “make chapter 1 shorter” continues the same conversation: Mentingo resolves the requested curriculum target, reads detailed content for only its selected lessons, and returns a scoped proposal for review. Core binds the session to its tenant, course, language and original author, then rechecks that author's current permission before reading selected lesson details. A durable event cursor and queued fulfillment complete the handoff when the browser disconnects; connected sessions also use a live fast path. If access has been revoked or selected context is unavailable, Core sends a scoped failure so the AI task does not wait indefinitely. The plus menu keeps file attachment, scope, web search, deep research, and strict source mode together in one anchored surface. A separate speedometer beside Send lets authors choose Fast, Balanced or Thorough reasoning for Mentingo's first-party AI; the choice does not grant web access or change which sources may be used. Strict mode limits generation to the prompt and uploaded files; clearing it restores general knowledge, while web search remains independently selectable. An empty scope means the entire course. Uploading a file shows an immediate composer chip, keeps the draft editable, and blocks Send until every selected source has finished processing with usable text; failed attachments must be removed. Uploading does not create assistant response loading or stop state. After send, each uploaded source chip belongs to its original user request only; later requests may reuse the session source policy without repeating that attachment card. The durable source inventory record gives the composer chip its filename and current processing status, and the sent request keeps the completed attachment on its own turn. Creating the first durable session as a consequence of accepting an upload preserves its composer chip until send or explicit removal. Source disconnect removes a source from future requests while retaining it in the session. The interaction opens in a bottom drawer that can close without navigating away or stopping generation. Requests and results remain chronological. Each request has one Live work group containing its web research and generation steps in order; the group stays expanded while steps are running or failed and collapses once they finish. The Plan starts collapsed with its step count shown, and both can be expanded on demand. The proposed-changes card is a highlighted card while it needs the author's action and turns neutral once applied or discarded. An outline proposal shows its chapters numbered with their lesson titles. While the AI works, the status line names the current step from the task kind (reading the request, planning the outline, planning lessons, writing a lesson, updating the course, reading sources or creating a visual) rather than a generic lesson label; the connected AI service does not stream model reasoning, so none is shown. Proposal review is read-only, identifies the operation and exact target, and closes after a final accept or reject decision. Accepted proposals remain distinct from applied changes until Core confirms application. A brand-new session visibly starts with General knowledge selected; reconnecting restores the saved source policy exactly, including an intentional all-disabled policy. Source-driven outline inference remains part of document conversion; the authoring request keeps its nullable exact-outline contract without exposing a manual outline editor. The older draft-generation entry remains available only through its preserved recovery route while its visible navigation link is hidden.

When an author asks to add a chapter to an existing course, the assistant treats it as an addition rather than a whole-course rewrite. It uses the current curriculum only to avoid duplication, researches the topic when web access is permitted, proposes only the new chapter for review, and places accepted lesson work after the current chapters. The Target control mirrors Curriculum with numbered chapter cards and expandable lesson and block rows, so exact edits remain understandable without exposing internal IDs.

Voice input inserts a transcript into the editable request without submitting it. Authors can stop recording to keep the transcript or cancel the current recording while preserving their typed text. The text field grows to four lines before scrolling, keeping longer instructions readable without taking over the conversation.

While an outline is being streamed or has been accepted for review, the authoring conversation keeps the draft available but does not replace Curriculum automatically. For a large accepted outline, Mentingo's connected AI service refines the lesson and source plan in bounded groups, then checks the complete plan before lesson writing begins; the author still approves the outline once and sees normal task progress. Review mode replaces the curriculum page with the proposed curriculum marked in place: new items are green and labelled **New**, edited items **Edited**, moved items **Moved** with their origin, and removed chapters and lessons stay visible, struck through, at their original position. Collapsed chapters summarize their changes and a **Changes only** switch hides unchanged rows. A flat sticky toolbar shows change counts, "change N of M" navigation (J/K), and one **Apply changes** action. All pending changes start included; the author can exclude or restore a change. A separate Request changes form accepts one instruction for the whole draft and sends it as a new conversation turn; the earlier iteration becomes read-only while the revision runs. Selecting a change shows the rationale and a before/after comparison without a second summary card above it. Quiz questions can expand for inspection, including visible fill-in-the-blank placements and answers, but their options cannot be added, removed, or reordered in read-only review. AI Mentor lessons, new or edited, use the editor's own AI Mentor form in the same read-only way, filled with the proposed name, scenario, voice, Mentor configuration and assessment; the configuration and assessment open in their usual dialogs for viewing only, without save, AI assistance, file upload, templates or the test button. Remaining educational concerns appear in a compact inline disclosure and require no acknowledgement. Excluding a change also excludes changes that depend on it; restoring it also restores prerequisites. Changes to lessons with existing assessment attempts still require the separate assessment-impact acknowledgement. Apply sends the selected verdicts in one fenced review command and starts one native course application. Entering or leaving review mode never mutates canonical query data or discards the draft. After Core confirms application, the workspace refreshes the curriculum queries, localized authoring context, and durable session before reporting the result. An automatic application failure or synchronization delay offers a retry; a conflict directs the author to regenerate. Neither state reports the draft as applied.

Durable socket events advance only in sequence. A duplicate is ignored; contiguous events update the local canonical turn projection without requesting a full snapshot for every event. Review-creating events also carry the bounded durable proposal or question record required by the chat projection, so the review card appears immediately in its assistant turn. A gap or server resync signal starts one coordinated recovery operation, refreshes the authorized snapshot with bounded `0/500/1000/2000 ms` backoff, and rejoins from the recovered cursor. If a queued or running turn/task remains active while the socket is silent, the workspace performs one durable snapshot reconciliation after five seconds and rejoins from that snapshot; if work is still active, later silence checks back off to 10, 20 and 30 seconds. The watchdog rearms only while canonical work remains active and stops when it is terminal or idle, while any genuine socket event resets the delay to five seconds; the immediate snapshot emitted by the recovery rejoin preserves the current backoff. Permission revocation is terminal for that editor, so cached content is not kept visible after access is lost. The authoring chat uses the existing `@ai-sdk/react` lifecycle as its single optimistic/transcript owner, while its feature transport maps the durable command receipt and ordered socket events into assistant text, phases and tool progress. Each request retains its durable identity, while its text, tool activity, questions, plans and proposal artifacts appear in event order across the conversation, including after reload. A preview stays linked to its owning part, and a later result from an earlier request appears below intervening messages. The durable `turns` snapshot uses `firstSequence` and `updatedSequence` as ordering and update authority, so a shorter final answer replaces an older partial without creating a second response. Proposal decisions use their revision; selected pending proposals are accepted by one fenced review command before native application. Missing operation dependencies block the apply action. Core performs application asynchronously and the workspace polls its receipt until it is applied, conflicted or failed. Only after an applied status is confirmed does the workspace invalidate and refetch course and lesson query families so new curriculum appears without a manual refresh.

Task lifecycle events also carry safe task diagnostics and result identifiers. A retry reuses the failed task and clears its earlier error as soon as it is queued or running; a later success replaces the failed state in the open chat. The browser localizes these stable diagnostic codes and never receives worker exception text or tracebacks.

The current rich-text lesson format and stable block identity remain authoritative. The workflow does not create a new learner-completion or certificate policy. Closing the drawer never triggers automatic navigation. Durable `assistant` records are rendered as assistant chat bubbles; incomplete records are ignored rather than replaced with fabricated text. The interaction follows the bottom while the author is at the latest position, including message growth, and excludes source-ingestion tasks from agent work when their source record identifies the task.

An empty-target request first passes through conversational routing. Greetings and guidance remain conversation only; whole-course generation enters course planning; a request to add chapters enters append-only planning; clear research requests use permitted web research; and existing-content edits resolve only trusted course targets or ask one focused clarification.

Course context reports the current draft, private or published visibility state. Published courses are publicly listed, private courses are restricted, and drafts are unpublished. The authoring operation allowlist does not change publication status.

After outline approval, lesson-writing progress appears below the outline in a separate live-work phase. Large lesson batches stay collapsed by default with a lesson-progress summary. Outstanding questions appear one at a time with previous/next navigation; a clarification offers up to three suggested answers labelled A–C and a D free-text alternative, while answered questions remain in their original conversation position. Evidence gaps from generated lessons are review notes, not repeated author questions.

Live work distinguishes creating an outline, planning the approved lessons, generating lesson content, checking the result and revising a plan. Authors can follow chapter names and completion during detailed planning. Lesson generation groups related work under its chapter, with completion counts and up to three currently running lesson titles; additional running lessons are summarized. Failed work and author actions remain visible, and completed research is retained as a chapter summary. Queued lessons retain their chapter context before writing begins, and saved progress survives a reconnect. This uses the existing work section without adding another approval step or progress toggle.

Verification for chapter progress (2026-10-05): all 332 CourseAuthoring unit tests across 35 files pass, including streamed progress, snapshot recovery, chapter grouping and retained research results. Web typecheck and lint pass with one existing unrelated test warning. Live provider generation and authenticated browser verification were not run for this change.

Generated lessons distinguish material for participants from production instructions in an uploaded syllabus. Presenter briefs, image-generation prompts and publication checklists stay out of learner-facing teaching; supported visuals use the asset preparation flow and unavailable media requirements remain author-facing notes. Source preservation still covers the complete learner material and supplied assessments. Assistant lifecycle notices use the conversation's resolved language separately from the course and interface language. When a course coherence check starts a targeted rewrite, the conversation retains a notice naming the affected lessons and explaining the reason before the repair jobs are dispatched.

## Key Technical Context

- Quiz question titles preserve basic text formatting while removing unsafe HTML during persistence and learner rendering, including for previously saved questions.
- Generated-image previews retry transient download failures twice, then show an error with a **Retry previews** action. Retrying the download does not regenerate the asset.
- Durable course-authoring sessions are the only supported AI course-generation workflow. The earlier draft/chat interface and automatic whole-course import have been retired; opening the curriculum no longer creates an old-style draft or runs its sync worker. Historical sync records and migrations remain for data retention, without active routes or workers. Authors review and explicitly apply proposals through the current workspace.

- The course editor and typed lesson editors remain the native content representation.
- Luma is Mentingo's connected AI service; new authoring integration is still under construction.
- Luma owns the assistant's planning, research, writing and conversation history. Core authorizes course access, provides selected native content, and applies approved changes to the course. Older turns are fetched in pages while current work remains visible.
- Core verifies context requests after removing the event-only record envelope, in both connected and replay delivery. Luma publishes a selected-content request only after its task has durably entered the waiting state, so Core's prompt callback cannot arrive before the task can accept it. The browser inserts new `task.updated` rows into the live task view, including tasks created after the initial snapshot.
- A single-item Apply reviews and submits the change; group Apply selected sends one atomic selection. A confirmed Core receipt remains available across a reload until the assistant's session projection records the applied state.
- Opening the workspace selects the latest accessible conversation. If none exists, or a saved selection is no longer available and the refreshed history is empty, the drawer creates and selects one new conversation only once. The conversation browser keeps prior chats available; **New chat** starts another durable conversation without replacing that history.
- Existing current course-edit access and `COURSE_AI_GENERATION` permission are both required.

## Test Evidence

When an author retries the same reviewed change, Mentingo retains the frozen selection instead of generating another version. Choosing to omit an optional image creates a distinct selection; an editor can also acknowledge assessment impact and retry a failed application without losing the reviewed content. After seven days, abandoned prepared material is eligible for cleanup, while material linked to a Mentor lesson or recorded in an applied change is retained. The focused code tests cover export identity, acknowledgement retry, and protected asset cleanup; live and authenticated end-to-end behavior remain unverified.

Reviewed quiz changes with a zero-hour cooldown apply as a quiz with no cooldown. This also covers saved selections created before the fix. A focused Core apply test covers this conversion; a previously failed application still requires the author to retry after the API reloads.

Focused frontend regressions cover recovery of completed unsent attachments after reload, attachment ownership on optimistic and saved messages, replay of clarification answers by task and revision, visible saved answers without duplicate inputs, and live answer-event projection. They also cover suppression of a stale web-search permission prompt after a grant or task completion.

Focused review tests cover the curriculum review model (added, edited, removed, moved and course-level changes), dependency-aware staged decisions, block and word diffs, quiz answer-key diffs, the review workspace flow including keyboard review and batch apply, the chat summary card, and receipt recovery after reload. Core bridge tests cover the actual event envelope in both live and replay paths. These tests do not yet prove a fresh authenticated provider run or that a previously blocked context request resumes after service restart.

Focused unit coverage verifies that an in-progress application remains visible after a page reload. The older-message paging contract has generated client and type checks, but its full authenticated browser flow remains unverified.

Focused tests cover stable block identity, selected-question scope, current authorization, workspace record validation, proposal dependencies, assessment-attempt acknowledgement, asset decisions, usage accounting and socket cursor duplicate/gap handling. The Core gateway reliability suite has seven tests covering shared streams, disconnect replay, gap reconciliation, join-during-recovery, ordered delivery and member authorization. The web reliability slice covers local canonical turn projection, zero per-event snapshot requests, single-flight bounded recovery/rejoin, terminal permission handling and the five-second active-turn silence reconciliation that projects a completed durable snapshot and rejoins from its cursor. AI tests cover structured-output method selection, schema preflight, function-call text streaming, append-chapter ordering and fan-out prevention. A live local API/provider check repaired and completed the previously rejected quiz writer task; a separate chapter request fetched two public pages and returned exactly one append-only chapter proposal. Composer and interaction tests cover the compact input, explicit source policy, curriculum-shaped scope semantics, async draft preservation and the read-only live preview. Local database tests cover native content and quiz application, retry deduplication and rollback when a selected operation fails, plus explicit asset consent and optional-image omission.

These checks establish the exercised local provider paths, but do not establish broad model-quality acceptance, an authenticated browser interruption/recovery E2E, or deployed socket behavior. Those integration and deployment boundaries remain unverified.

The Core native apply fixture now includes every canonical quiz question type, a Mentor lesson with Judge criteria, staged lesson/quiz/Mentor images, and an independent Mentor operation in the same atomic application. The Core-to-AI roundtrip fixture now drives session creation, context, request, proposal acceptance, export queueing, session replay, and receipt status through authenticated Core HTTP routes. These expanded database-backed scenarios are authored but remain unverified in this checkout because the required isolated `authoring_probe_<hex>` database and AI HTTP fixture credentials are not configured.

The local mocked browser regression also verifies that the composer controls and the nested source selectors consume Escape in order while the drawer stays open. It covers keyboard and pointer resizing, composer multiline growth, and a bounded 390x500 viewport without page errors; it does not establish authenticated or live-provider behavior.

The current mocked browser pass also verifies same-trigger closing for Sources and Options, the active-task Stop action replacing Send, a stable animated prompt placeholder with typing dismissal, and the reduced text-mode left inset. The temporary fixture was removed after verification.

Nested research-depth and source-replacement Selects were separately verified by clicking their visible triggers again; each closes without dismissing its containing popover. Active live-work requests expose a compact icon-only Stop request action that still targets the owning request. Requests waiting for author or dependency input expose the same compact action as a request discard, which stops remaining work and terminally removes that draft from the session.

## Session knowledge and course coherence

Research and uploaded document passages are stored in the authoring session, isolated by organization. Luma uses native 1536-dimensional passage vectors together with lexical search; later requests and parallel writers can retrieve permitted session knowledge without relying on chat history. DDGS discovers pages and Trafilatura extracts fetched content. Research shares a request budget, follows useful leads, and records quote-backed findings. It does not introduce a full knowledge graph or video curation.

Detailed planning maps each lesson's objectives and Bloom level to practice, assessment criteria, evidence and explicit gaps. Writers receive that lesson map and can retrieve relevant passages or research a narrow missing fact when web access is enabled. The approved source permissions remain part of the task contract. Clearly labelled fictional exercises remain separate from the evidence supporting factual claims. Creator warnings do not become instructions asking learners to verify the course's own content.

Once all lesson drafts exist, a course-wide review checks actual revision-pinned bodies for progression, repetition and assessment alignment. It can dispatch one bounded repair round for still-reviewable drafts; accepted, rejected or changed revisions are not silently regenerated. The same live-work view shows research, writing and course review using localized activity labels.

The AI migration replaces the authoring JSON-vector index and preserves unrelated document knowledge. Upgrade, retrieval, downgrade and re-upgrade were verified in a disposable PostgreSQL database; no working database was migrated during implementation. Live-provider quality and authenticated end-to-end behavior remain unverified.

### Complete source reading and visible upload blockers

Course planning and whole-document questions read permitted extracted document bodies in their original order, rather than treating a few search matches or heading labels as the entire file. Reading returns explicit coverage and continuation offsets for larger documents. Targeted passage search remains available for individual questions and lesson writing. Excluded sections and their descendants remain excluded; only fully indexed selected sources can be read.

A selected upload that is still processing or has failed appears beside the composer even when it came from an earlier upload. Sending stays blocked until all selected files are ready or the author removes the blocking selection. Removing an older selection does not attach unrelated ready files to the next chat message.

Detailed-plan evidence validation recognizes both ordered document reads and retrieved passages. A fully returned ready section can support a lesson evidence reference; catalogues, omitted sections, non-ready content and incomplete section slices cannot. Required references to duplicate selected versions retain their source-specific identities. Generation and review receive evidence as structured JSON rather than an escaped JSON string. Failed tasks use the existing retry command with an explicit recovery action, retaining author approval and review/apply boundaries. Rejected planning responses remain available for diagnosis and repair, but cannot be reused as accepted chapter plans.

### Writer validation and diagram brief recovery

Live lesson generation exposed a missing specialist-validation boundary: function-calling returns a JSON mapping, which must first be validated against the selected Content, Quiz, or AI Mentor writer schema. Canonical conversion now retains typed discriminators and creation payload defaults while leaving updates and metadata/settings patches sparse. Validation failures record safe schema paths and error categories without retaining model content in diagnostics. Writer guidance explains native UUID, fill-in answer-set, marker, and visual request constraints.

Generated visual briefs are bounded to 8,000 characters without truncating necessary details. GPT Image Sunburst uses low quality for standard requests and medium quality for premium requests; higher quality tiers are unavailable to the agent. The agent chooses bounded square, landscape or portrait sizes instead of unrestricted high resolutions. Image-generation timing and provider usage are traced internally in Langfuse; user responses omit token, cost and invocation accounting. Images retain the existing inline lesson-node, preview, approval and Apply workflow. A provider timeout with uncertain completion requires explicit retry approval.

Read-only fill-in word chips use symmetric horizontal padding and a consistent gap between the correctness icon and label. Correct-answer colors remain intact; read-only mode independently hides add/remove/delete actions even when a separate structure lock is absent.

Assembled review receives complete, permitted source passages cited by each review window, loaded once under the task fence. Partial or unavailable citations remain explicit gaps. When a source-supported assessment fact is missing from a generated lesson, review targets teaching that fact rather than deleting it from the assessment. Shared topics or outcomes alone do not count as duplicate questions. Feedback language is not a request to translate learner-facing content.

### Discarded proposal history

Discarding a proposal keeps its card and proposed details in the conversation, marked Discarded. Its contents remain readable after refresh, with no review, apply or discard actions. Snapshot restoration treats discarded proposals as terminal declines rather than reviving them as pending work.

### Course context for generated AI Mentors

Applying a generated Mentor prepares a retrieval document from authorized content lessons in the same course and accepted content lesson operations in the same frozen export. Updated bodies replace older ones; deleted lessons and chapters are omitted. Quiz answer keys and other Mentors' internal instructions are excluded. The document is attached through the existing Mentor knowledge-file pipeline alongside selected source documents.

Document extraction and embeddings finish before course changes are applied. Preparation failure prevents application; retry reuses a ready document with the same tenant/export/operation filename and content checksum. A generated-context metadata marker allows a later Mentor application to replace its previous generated context links while preserving manually attached and selected source files. This is a snapshot at application time, not automatic synchronization after later course edits. When no eligible content exists, no empty context document is created.

Validation for these follow-ups: 599 AI authoring unit tests, 334 web CourseAuthoring tests and 32 focused Core API tests pass. The Core tests cover authorized lesson collection, updated/deleted content filtering, failed preparation blocking application and attachment to the saved Mentor. Live-provider generation, real document embedding and authenticated end-to-end application remain unverified.

### Author choices during coherence repair

A course-wide coherence finding can pause repair for one material author decision.
The author receives three concrete suggestions (A/B/C) plus the existing free-text
Other option (D). Straightforward defects continue through automatic bounded
repair, and a review does not ask separate questions for each lesson. Pending
questions survive recovery without re-running review. After an answer, review
interprets the choice within the approved course and source permissions before
scheduling repairs; edited, accepted or discarded proposals remain protected.

Report findings, repair explanations and question text follow the conversation
language rather than translating the learner-facing course. Language and the
answered decision are included in the review cache identity, preventing reuse of
an English result for a Polish review. Previously persisted reports are not
rewritten. Automated tests cover the shared question checkpoint/resume flow;
live model language quality and authenticated browser behavior are unverified.

### Creator language and review attachments

Approving an outline preserves the conversation language for detailed planning,
lesson completion notices and subsequent course review, independently of the
learner-facing course language. Web-search permission uses localized question
and choice labels. Existing persisted messages are not rewritten.

Detailed lesson planning defaults to bounded chapter groups of at most six
lessons; batch-size selection does not require a separate model call. Completed
coverage, approved identities and source permissions remain authoritative across
groups. Model latency and the existing initial outline write/review rounds still
contribute to waiting time.

The curriculum review receives selected source metadata and ready generated
asset identifiers from the authoring session. Mentor source attachments are
shown as ordinary file cards using actual uploaded names. The course-context
snapshot is prepared during application and is not presented as an already
attached review file. Generated visuals are loaded through the existing
session-authorized asset-preview endpoint; temporary preview URLs are display
values rather than saved course asset references. Authors can inspect generated
images inline in the Changes and After views before applying any course changes.
The Form field uses the standard Tiptap content editor in read-only mode. Images remain
at their inserted positions as the standard image nodes, with openable file links and
without drag or remove controls.
Inline preview views show a fallback card only while an image is unavailable. Open review groups receive asset readiness updates from the active
session; missing previews display a status instead of an empty content block.

The reported session's two latest Napkin PNGs were present and matched their
stored manifests; their proposals retained the owning lesson markers. No export
or application receipt existed for that session. Preview resolution therefore
restores review visibility without regenerating or applying those assets.

Validation: 612 AI authoring tests and 343 web authoring/preview tests pass. Web
TypeScript and scoped lint checks pass; additional regressions cover real source
file cards and delayed protected-image resolution without modifying proposal
HTML. Live provider timing and authenticated browser/apply behavior remain
unverified. The wider AI service typing slice retains existing baseline errors.

### Parallel planning and targeted Mentor references

Detailed lesson planning runs chapter batches through LangGraph Send with at most
three concurrent model calls. Each batch retains its own validation, cache and
progress; results are merged in approved course order. Approved source ownership
stays fixed. Any missing required-section ownership is allocated against the
approved topics before fanout, rather than assigning unrelated sections by count.
A material clarification remains one course-level question.

A Mentor writer can create a focused reference brief from permitted source and
course material, including relevant facts, constraints, source attribution and
legal dates. Core prepares that immutable operation-bound text file through the
existing document pipeline and attaches it instead of the broad source/course
snapshot. Review displays it as an ordinary file card. Legacy proposals retain
the previous selected-source and course-snapshot preparation. Reapplication
replaces generated reference links while preserving manual attachments.

Native operation locales are bound to the authorized authoring-session locale;
Polish prose does not automatically add Polish to an English course or change its
base language. Known unsupported-language application failures are displayed
using the existing specific error message. This does not rewrite old frozen
exports: a previously frozen export containing invalid locales needs a newly
generated draft/export.

Read-only diagnosis of the later failed Apply found English course locales but
Polish lesson operation locales. Application stopped before lesson persistence,
so the generated images were not saved into lessons. Regression tests cover
image-marker conversion into protected native lesson resources, targeted-file
preparation and attachment, and preservation of legacy preparation guards. No
new course-language management capability or database migration is introduced.

Validation for concurrent planning and targeted references: 630 AI authoring
unit tests, 26 focused Core API tests and 350 web tests pass. API/web typechecking
and lint pass (one existing web test import warning); scoped Python lint and
format checks pass. Provider-compatible strict allocation-schema conversion is
checked locally. Live provider timing, actual embedding and authenticated Apply
remain unverified.

### Author authority over evidence-limited drafts

After an evidence warning, the author's confirmed instruction to continue
produces a source-based draft with visible review concerns. Independent
verification gaps do not cause repeated refusals or repeated requests for the
same sources. The author decision follows outline approval and lesson work,
while document selection, research permissions and factual attribution remain
unchanged. The assistant still asks a focused question when a material scope
decision is unresolved and does not invent missing legal or product facts.

This affects drafting only. Review, approval and application remain explicit;
author permission to draft is not a claim that the underlying information has
been independently verified.

### Research activity transparency

Authors can expand grouped web-search activity to see the actual queries as
bullets, including completed searches. Duplicate queries are shown once within
the same task; searches belonging to different requests retain their scope.
The interface displays query history returned by the research service rather
than inventing queries from task titles. Successful fetched pages stay available
to the research report, and incomplete first results lead to focused follow-up
research within the existing budget before unresolved gaps are handed back.

### Iterative review policy

Scoped edits return after structural checks without an extra educational review model pass or
implicit web search. Larger drafts and assembled courses expose quality findings as advice, without
automatically replacing proposals or generating lessons again. Authors request revisions explicitly.
Task completion reports execution success; educational quality findings remain a separate review
signal. Provider response time remains variable.

### Actionable generation recovery

Authors can continue an interrupted generation request without rebuilding its completed work. The activity rail shows failed chapter plans and bounded repair progress. A retry creates fresh content for failed parts while retaining accepted plans and research. Failure guidance survives reopening the session and distinguishes a content problem, an unavailable provider, a required author decision and a service problem.

When an author decision is needed, the existing saved question flow collects the answer before generation resumes. Malformed model output is handled internally; a provider or implementation failure is not presented as a content question. A service failure has no ineffective Retry action. Clearly labelled fictional practice exercises are permitted without a hidden mode selection, while factual assertions still follow the selected source permissions.

Focused tests verify safe failure contracts, retained failure guidance, retry clearing, failed chapter progress and recovery actions in both activity layouts. Authenticated browser recovery and live provider behavior remain unverified.
