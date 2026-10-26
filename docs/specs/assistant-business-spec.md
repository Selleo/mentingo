# Assistant

## Business Overview

Assistant helps users find learning resources and ask questions about information they can already access in Mentingo. They can continue a saved conversation, follow references to relevant product pages, and return to earlier answers without starting their search again.

For HR and L&D teams, this provides another route into assigned learning and internal knowledge. The same interface serves different users while keeping the available information tied to each person's current access. Tenant administrators can review Assistant conversations in the existing AI Conversations inbox.

## Who Uses It

- Learners find relevant courses, lessons and internal knowledge, then ask follow-up questions in a saved conversation.
- Content creators, trainers and group managers use the same Assistant to explore information available through their own permissions.
- Tenant administrators review conversations in AI Conversations to understand how the Assistant is being used within their organization.

## Feature Functions

- Find learning resources and accessible platform information through natural-language questions.
- Follow links to people and content mentioned in answers, with compact previews on hover or keyboard focus and a working action that opens the record within the app. All references appear inline without a duplicate Sources list.
- Return to the most recently selected active conversation in the current browser session, or explicitly start a new chat.
- Continue the same conversation from a draggable floating bubble while browsing other pages. Open a compact chat, minimize it, or move it to the full Assistant page with the unsent draft. Dragging the bubble onto the close target hides it without cancelling generation or clearing the conversation.
- Ask follow-up questions using the conversation's retained history.
- Dictate a question into the draft using the microphone, review the transcription, and send it when ready.
- See whether the Assistant is starting, working, searching, reading or writing while waiting for a response, then follow references to verified Mentingo destinations.
- Search active or archived conversation history and load earlier messages.
- Stop an active response and retain any partial answer with a visible cancellation or failure label.
- Review Assistant conversations alongside Practice and AI Mentor conversations in the administrator inbox.
- Keep Assistant activity limited to reading information; conversation management does not authorize changes to courses, assignments or other business records.

## End-User Value

Users can move from a question to a relevant learning resource with less navigation. Saved conversations preserve context for later follow-up, while references help users inspect the information behind an answer. Administrators gain a consistent review surface for AI interactions across the organization.

## How It Works

A user opens AI Assistant from the sidebar (standalone for non-administrators, grouped under AI for administrators), types a question or selects a suggested starting prompt, and sends it. Mentingo creates or continues their conversation, searches or reads accessible information when needed, and displays the response with relevant references. The Assistant uses normal, concise, helpful language similar to the Slackbot and follows the latest user message’s language. The user message appears immediately when sent, before the Assistant’s response. A single readable status reflects saved execution activity rather than a timed animation. Users can stop generation, copy an answer, or return later through the conversation history. The composer also supports microphone transcription using the existing voice connection. Stopping records the final text into the draft; cancelling discards the current recording. Transcription never sends a message automatically. If the combined draft exceeds 8,000 characters, it remains available for editing and cannot be sent until shortened.

Conversation history opens in a right-side drawer with Active and Archived tabs. Archived conversations remain readable and cannot receive new messages. The conversation UI does not expose rename or archive actions. Only one response can be active in a conversation at a time. A failed send preserves the draft for retry, and retrying the same accepted request does not create duplicate messages.

An authorized administrator opens AI Conversations from the same AI sidebar section and selects the Assistant type to review conversations within their tenant. The transcript includes retained partial responses and their status. Assistant conversations do not have lesson results or evaluations. A user's normal Assistant history remains limited to their own conversations, including when that user is an administrator; oversight uses the separate administrator view. The composer discloses that authorized administrators can review conversations.

When the user leaves Assistant with a selected nonarchived conversation, a floating bubble appears elsewhere in the authenticated app. It can be dragged with a pointer or touch and moved with arrow keys. Position and expanded/minimized state persist between pages, including administration and lesson views. Its compact panel uses the same transcript, message controls and transcription as the full page. Full-screen navigation opens the same conversation. Closing the bubble keeps the session and saved messages; visiting Assistant makes it available again on the next departure. The compact draft survives minimizing and transfers to the full page. The bubble is hidden on Assistant, on authentication pages and for invalid or archived selections.

The interface shows when the Assistant runtime is unavailable and prevents sending new questions. Conversation and content requests include a supported language. Answer accuracy, relevance and multilingual quality still require validation with a live provider.

## Key Technical Context

- The user-facing route is `/assistant/:threadId?`; the main API area is `apps/api/src/assistant`. Every authenticated active user can use Assistant, including users with custom roles. Access to the bot does not grant access to platform records. Administrative oversight retains the separate `ai_thread.read` permission.
- Conversations are scoped by both owner and tenant. Current account and permission checks apply to API requests and background execution; PostgreSQL tenant policies protect stored Assistant threads, messages and runs. Existing learner lesson-result endpoints do not read Assistant storage.
- The native Assistant reuses Mentingo's permission-aware read tools, including shared learner search. Its tool allowlist excludes write operations and does not create an OAuth grant. Available reads can include learning content, knowledge articles, news, Q&A and permission-controlled user/group information.
- Greetings, general help and clarifying questions can complete without a content read. Invalid final proposals receive bounded model feedback for correction before publication. Factual final answers require a successful read. Content explanations marked as needing readable content additionally require a successful readable-content fetch; search metadata alone does not satisfy that check. These checks provide execution evidence, not a guarantee that every generated statement is correct.
- References are restricted to canonical, tool-returned Mentingo records and real destinations available to the user. Previews show saved title, record type and optional description from the authorized read, without fetching more data or remote images. They are a historical snapshot; following the link checks current destination access. References appear only as links in the answer; retrieved candidates are not displayed as a separate list. Raw model links are filtered, and the Assistant UI suppresses unverified links and remote Markdown images. Readable lesson support excludes hidden quiz answers and unsupported content.
- Durable generation uses WorkflowAgent, the AI SDK's workflow agent, with Workflow state isolated in PostgreSQL schemas within the main application database, using the existing app connection and credentials. Saved partial responses are polled by the UI. A durable pending handoff can be retried by recovery; cancellation prevents later response updates from replacing the cancelled outcome. Workflow data and enums use `workflow`, with SDK migration tracking in `workflow_drizzle` and jobs in `graphile_worker`. A pinned dependency patch prevents legacy Workflow migrations from touching Core enums in `public`; migration setup remains separate from normal Core migrations.

## Test Evidence

- **Backend focused checks:** 75 tests cover native read-tool restrictions, permission refresh, evidence and reference handling, execution state and related Assistant behavior.
- **Real HTTP and database checks:** all 15 tests in `apps/api/src/ai/__tests__/admin-ai-threads.e2e-spec.ts` passed against disposable PostgreSQL/pgvector and Redis. These use a non-superuser, non-BYPASSRLS application role and verify tenant isolation, private ownership, administrator oversight, unified filtering and pagination, retained partial failures, idempotent sends, active-run conflicts, cancellation, archived conversations, unavailable-runtime behavior and revoked permissions. The workflow runtime is stubbed in these HTTP tests.
- **Frontend checks:** 45 relevant tests passed, including nine Assistant tests. Isolated desktop and mobile fixture screenshots were also inspected. Authenticated browser verification also passed demo login, the Assistant page, availability and thread-history reads in the isolated Hangar environment. A browser-found boolean query validation issue was fixed and covered by six additional HTTP tests. This does not establish live model generation.
- **Durable runtime smoke:** a real WorkflowAgent completed against a dedicated disposable PostgreSQL workflow database using a deterministic model. The smoke exercised a native tool step, streamed partial checkpoint, final outcome, and correlated trace context with user/session attributes. It did not call a live AI provider.
- **Dictation checks:** mocked composer tests cover recording, stopping, cancellation, delayed delivery, draft preservation and character limits; the shared transcription hook tests cover transport ownership and cleanup. Real microphone capture and transcription-provider delivery have not been exercised for this page.
- **Remaining verification:** live browser-to-provider generation, deployed recovery across a real process restart, live answer quality and provider latency have not been established by these checks.

- **Linked-record and universal-access checks:**69 focused frontend tests cover authenticated-only routing, custom roles, separate oversight permissions, previews surviving rerenders, pointer/keyboard interaction and internal navigation.52 backend unit tests and6 HTTP/database cases cover canonical links, exact unambiguous name linking, filtered citations, stale permission grants and private owner/tenant access. Preview interaction was also checked in a browser with deterministic fixture data; this does not evaluate live model answer quality.

- **Access verification refresh:**54 focused native MCP, learner-access, lesson-scope and permission-parity tests passed. These include learner enrollment/tenant SQL constraints, inaccessible lesson rejection, hidden assessment content exclusion and fresh tool-permission checks. This is a mix of unit/service/query-shape tests, separate from the real HTTP/database cases above, rather than a full live-model role-by-record matrix.

- **Floating conversation checks:**86 relevant Assistant/dashboard/authentication cases and56 role-navigation cases passed. Pointer gestures, session-preserving dismissal, fullscreen draft transfer and narrow/dark layouts were checked in browser fixtures; authenticated testing also opened an existing tenant1 conversation in the real floating panel and returned to its full page. These checks did not send a model request.

- **Pre-PR access hardening:** private client caches are scoped to the signed-in account and tenant; logout invalidates pending results, including delayed sends. Tenant suspension stops background execution and permanently fails the current run. Recovery reconciles stale bound runs with terminal Workflow state, preserving partial output and allowing another message after infrastructure recovery. These paths have deterministic regression coverage; deployed outage recovery and live provider behavior remain environment checks.

- **Shared-database storage regression:** four disposable PostgreSQL cases verify fresh SDK bootstrap and rerun, preservation of application schema/enum identities and records, upgrades from pre-enum-isolation and fully migrated SDK history, and real queue startup/enqueue/consumption. The runtime role is a non-superuser with Graphile object ownership and is denied Core table reads. An unpatched collision is reproduced as a negative control. This is representative-fixture coverage, not a full production database rehearsal.
