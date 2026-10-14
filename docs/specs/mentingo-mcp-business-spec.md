# Mentingo MCP Integration Business Spec

## Business Overview

Mentingo MCP lets content creators maintain training from a conversation with their connected AI assistant. An editor can ask for a new onboarding course, a lesson update, or a change to internal knowledge content, and inspect the saved result in Mentingo.

MCP (Model Context Protocol) lets an external assistant discover and use many of Mentingo's tools for courses, lessons, categories, articles, news, Q&A, learning paths, and supported files. The assistant interprets the user's request; Mentingo performs the available operations under the user's existing account and access.

For HR and L&D teams, this can reduce the manual steps between preparing material and maintaining it in the learning platform. It also lets teams keep using their preferred compatible assistant while Mentingo holds the courses, resources, and publication state.

For connection instructions, example prompts, and a suggested demonstration, see the [MCP guide](../mcp.md).

## Who Uses It

- Course creators build an onboarding draft with chapters and lessons, then review it in Mentingo before publication.
- Editors maintain lessons and supporting files in courses they can edit, so training can reflect updated procedures.
- Category managers organise courses and maintain category translations so authors can classify training consistently.
- Content administrators update knowledge articles, news, Q&A, and development paths within their existing access.
- HR administrators find and update existing learners, maintain group memberships and roles, and create or translate groups using their existing access.
- Platform administrators customize branding, registration preferences, feature availability, and company information using their existing access.
- Learners search and read accessible courses, articles, news and Q&A through a limited student connection. Editors use separately approved management scopes to inspect and maintain content.

## Feature Functions

- Build and update courses, chapters, content lessons, quizzes, AI Mentor lessons, embedded lessons, and live training lessons.
- Find existing training and inspect its structure before making targeted changes.
- Maintain knowledge articles, news, Q&A, categories, and development paths from a connected assistant.
- Attach supporting files, place lesson resources as previews or downloads, upload video, and import SCORM packages through Mentingo's upload flows.
- Manage course publication, pricing, certificates, and assigned-group deadlines when the editor has the required access.
- Maintain content in the languages available for the target course or editorial resource.
- Search accessible courses, lessons, development paths, news, articles, Q&A, users, categories, and groups in a supported language.
- Read and update existing users, group memberships, and roles; create, read, and update groups and translations. User creation/import, archiving/deletion, group deletion, and credential operations are excluded.
- Customize company information, registration fields, feature preferences, currencies, age limits, featured courses, live training capacity, branding images, and public login documents. SSO and MFA settings are excluded.
- Open search results directly in the connected tenant using links returned by Mentingo.
- Connect a learner assistant with the exclusive `student:read` scope for search and eight reader list/get tools, keeping authoring, administration, lesson bodies and file URLs unavailable.
- Request explicit per-domain read/write scopes for management workflows; scopes narrow existing account permissions rather than granting new permissions.
- Connect with explicit account consent and expose tools according to current permissions and enabled tenant features.

## End-User Value

Editors can move from an instruction to a saved training change with fewer manual editing steps. They can review results in the same platform that delivers the training, reuse their existing assistant workflow, and maintain courses alongside knowledge content and supporting resources.

## How It Works

The editor connects their assistant, asks it to inspect the available content, and gives a focused instruction. The assistant calls Mentingo's tools and reports the saved result. The editor opens Mentingo to review the course or editorial content and decides when to publish it.

MCP writes take effect directly; this connection does not create a separate proposal awaiting approval inside Mentingo. To prepare training for review, explicitly request a draft course. Publication behaviour differs across content types: article creation publishes immediately, while news creation defaults to a draft.

The editor adds the remote `https://<tenant-host>/api/mcp` endpoint in a supported MCP client. The client discovers Mentingo's OAuth metadata, registers as a public client, and opens Mentingo's connection page in the web app. The editor signs in with the existing Mentingo browser session and chooses Allow or Deny. New clients must request explicit scopes and the consent page lists them before approval. Missing, unknown or duplicate scopes are rejected. The learner scope `student:read` is exclusive and cannot be combined with management scopes. Management read/write scopes are separate and do not implicitly include each other. The client exchanges the one-use authorization code using PKCE. Mentingo stores the resulting opaque access and refresh grants in Redis, bound to the user, tenant, client, resource URL, scope, and expiry.

Each MCP HTTP request validates the access grant, active user and tenant, and resource audience. Mentingo reloads current roles, permissions, and tenant feature switches before advertising tools, then reloads permissions again for each tool call. Domain services still enforce ownership and entity rules. The MCP transport's session ID never serves as an authorization credential.

A student assistant helps users find accessible course information, knowledge articles,
news and Q&A, then read bounded learner content or open it in Mentingo. It exposes
`global_search`, `list_student_courses`, `get_student_course`,
`list_student_articles`, `get_student_article`, `list_student_news`,
`get_student_news`, `list_student_qa_entries` and `get_student_qa_entry`.

The student actor retains the same user and tenant identity but has only the
intersection of the account's current permissions and default student permissions.
Elevated role shortcuts are excluded; no permissions or enrollments are added.
Course reads return metadata only and reject drafts, archived courses and unenrolled
private courses, even if the connected account is the author. They exclude chapter
and lesson bodies, assessments, authoring configuration and file URLs. Article/news
reads require published, learner-visible content in an available language; Q&A reads
require the requested language. Their returned original text is sanitized, excludes
embedded resource objects and signed URLs, and is capped at 16,000 characters with a
truncation marker. List titles cap at 500 characters and summaries/course descriptions
at 2,000. Course, article and Q&A lists accept bounded pages of at most 25; news keeps
its learner API's fixed page size.

Student global search skips lesson, development path and directory retrieval. Course
matches use only title/description documents, in keyword and hybrid modes, so hidden
lesson/file text cannot cause a course match. Course search passages and attachment
filenames are omitted. Eligible editorial file text shares the same permission-filtered
FTS retrieval in keyword and hybrid modes; hybrid adds semantic matching. Both depend
on background indexing for extracted file text. Files remain subject to visibility
checks and no result constructs a download URL. Canonical source links use the tenant
bound to the OAuth grant; opening them requires the viewer's own Mentingo access.

Each Slack workspace pairs to one Mentingo account. All Slack participants therefore
share that account's learner visibility and enrollments, rather than acquiring their
own personal Mentingo permissions. Per-person enrollment isolation requires separate
account linking.

New management requests use `search:read`, `courses:read`, `courses:write`,
`categories:read`, `categories:write`, `articles:read`, `articles:write`, `news:read`,
`news:write`, `qa:read`, `qa:write`, `learning_paths:read`, `learning_paths:write`,
`users:read`, `users:write`, `groups:read`, `groups:write`, `platform:read`,
`platform:write` and `files:write` as appropriate. `search:read` retains normal
account-permission search, not the student projection. Management reads may expose
drafts, configuration and other authoring data when the account has access.
`readOnlyHint` indicates absence of mutations, not student-safe output.

Previously issued `authoring` and `search` access/refresh grants preserve their
existing access until reconnect, subject to expiry, revocation and current account
permissions. Legacy authoring has a frozen explicit management tool catalog;
legacy search remains limited to global search. Neither gains student tools, and no
new authorization/consent flow may issue those legacy scopes. A code exchange or
refresh cannot change its approved scope set. Reconnection with a new authorization
and explicit consent is required to change scopes.

Mutations that publish, delete, reorder, or change pricing, certificates, or media position check the current entity revision under a tenant-scoped row lock. Destructive calls also require exact title, type, ID, or child-ID confirmation as appropriate. Retried creates and path course additions require an idempotency key scoped to the tenant, user, client, tool, and input. MCP calls record the client, tool, entity ID where available, outcome, and request ID through the existing activity log queue. MCP errors return stable codes, HTTP status, and a readable message without leaking untranslated internal message keys.

The connection page uses Mentingo's web components, tenant platform logo, login background, and theme colors. The API validates the OAuth request, redirects to the web page, and supplies connection details only to the signed-in user for the current tenant. The web page posts the decision to the API, which consumes the one-use consent request and completes the OAuth redirect. The OAuth and `/api/mcp` routes remain Nest controller routes. A dedicated guard checks the MCP bearer token, tenant, and resource before the protocol endpoint uses the official MCP SDK's Node request/response adapter.

MCP advertises upload instructions during connection initialization, in capability discovery, and in relevant tool descriptions. The shared `request_generic_file_upload` tool accepts article/news content files with an existing target ID and language, then delegates to the native editorial upload service. Its response explains how to upload the bytes and insert the returned resource ID into content with a fresh revision. Course/quiz generic uploads retain their raw `fileKey`/`fileUrl` response; article/news files retain durable resource URLs and normal resource linkage. Covers and videos keep their dedicated flows.

Local agents can request a narrow multipart grant for the authoring upload routes, with the target, language where applicable, file name, MIME type, size, and relevant form metadata bound to the grant. The course thumbnail grant also binds the required position. Multipart grants are consumed on one request, and access is rechecked before the file is saved.

Lesson file uploads create a resource before it appears in lesson content. The editor passes the uploaded `resourceId` to `insert_lesson_resource`; the tool verifies access, adds the appropriate content node, and the existing lesson update flow attaches the resource to that lesson. A newly uploaded file therefore need not appear in `list_lesson_resources` before insertion.

The upload tool returns a complete `uploadUrl` built from the tenant URL bound to the MCP connection, plus `uploadRequest` with the HTTP method, Bearer header, multipart `fileField`, and required `fields`. The local agent sends the file bytes to that URL exactly. It lets the HTTP client set the multipart `Content-Type` boundary. The API recognizes prefixed upload Bearer tokens separately from normal app tokens, then rejects a different route, method, tenant, file name, MIME type, size, or bound metadata. A failed or interrupted upload consumes the one-use token; the agent requests a fresh grant before retrying. Legacy `Authorization: Upload` grants remain recognized until they expire.

SCORM grants bind a ZIP file and exact authoring metadata to `POST /api/scorm/course`, `POST /api/scorm/lesson`, or `PATCH /api/scorm/lesson/:lessonId/package`. A multipart course import can bind a thumbnail in the same request. With `transport: "tus"`, the same tools initialize the existing package-only SCORM TUS session and return its complete upload URL, headers, upload ID, and complete URL. Video initialization uses the native provider flow: S3 uploads receive a session-scoped Mentingo Bearer header and a complete URL on the tenant host; Bunny uploads use the provider's returned URL and headers. Resumable grants are bound to the session, expire with it, and recheck tenant, user, current permissions, and target access on each Mentingo request.

## Current Delivery Scope

The implemented tool set also includes permission-aware global search, platform customization, existing-user management, and group creation and maintenance. Its content tools cover course discovery, category lookup and management, course creation and updates with the native API schemas, course settings and publication/pricing/certificate/media changes, group assignment deadlines, chapter and lesson discovery, ordering and deletion, content, quiz, AI Mentor, embed, and live training lesson creation and edits, lesson resource discovery, placement and detachment, Q&A entry CRUD, article section and published article/content edits, draft and published news discovery and edits, development path metadata, certificate settings and course ordering, multipart authoring uploads, resumable video uploads, and SCORM course/lesson imports through multipart or TUS. Article creation through MCP follows the existing web API: it immediately publishes an article with the default title and empty content. The agent then calls `update_article` to fill it in. News creation defaults to a draft, while development path creation accepts the statuses supported by its API. Article and news updates can set public visibility. SCORM creation and package attachment complete when the local agent sends the ZIP through the existing API route.

Customization uses the existing platform services and upload validators. Boolean preferences are exposed as explicit toggle operations with required retry keys. Platform images, user avatars, and login documents use scoped, one-use upload grants for their native multipart endpoints. Branding images retain the native 10 MiB limit, user avatars retain 5 MiB plus square/1024-pixel constraints, and login documents retain the file service limit of 1 GiB. No separate MCP byte limit applies. Login documents can be listed, added, or removed with exact-name confirmation; the native service does not support replacing a document in place. Global search reuses the existing platform search service and its per-result permissions, enrollment, ownership, tenant, and localization rules; it is not a separate semantic search engine.

## Key Technical Context

- The backend lives in `apps/api/src/mcp`, with the public transport at `https://<tenant-host>/api/mcp`, OAuth endpoints at `/api/oauth/*`, and metadata at `/.well-known/oauth-*`.
- The resource URL is derived from the active tenant host; production tenant hosts require HTTPS. A token presented on another tenant host is rejected.
- The authorization library handles authorization code exchange and PKCE. Mentingo supplies the consent UI, client registry, Redis grant storage, and existing sign-in identity.
- The connection screen is the web route `/oauth/connect`; its consent details come from `/api/oauth/consent/:consent`, while the API remains responsible for approval and denial.
- The adapter calls existing domain services inside tenant RLS context and uses permissions from `@repo/shared`. It does not use the integration admin API key.
- Changes are persisted through existing domain services and their outbox, search, and resource behavior where those services provide it.

## Test Evidence

New focused tests cover explicit scope validation, the exclusive student catalog,
management discovery and direct-call rejection, legacy-grant preservation, scope
preservation and refresh escalation rejection. Student-tool tests cover bound account
identity, metadata projection, published article mode, feature checks, content limits,
file URL exclusion and Q&A language availability. Learner course access and global
search tests cover ownership shortcuts, metadata-only course matching and content-only
retrieval. These new tests were not run locally for this change; CI validation remains
pending. The coverage described below is historical and does not establish execution
of the newly added scope/student tests.

Prior local validation included the MCP unit suite and real HTTP tests against disposable Postgres, Redis, and S3-compatible storage. The HTTP tests cover OAuth consent, PKCE, token exchange and revocation, authenticated MCP calls, user/group operations, search, real multipart image/PDF uploads, editorial resource insertion and read-back, permission checks, and tenant isolation. These tests do not establish browser-based consent, third-party Claude OAuth, or deployed behavior. Focused unit coverage also verifies tool registration, REST permission parity, argument validation, excluded user/group lifecycle operations, actor forwarding, file MIME consistency, exact upload route/metadata binding, and single-use grant consumption.

Revision checks protect updates that accept an expected revision, including content-lesson edits. After a conflict, the assistant must reload the target before retrying. Browser-based MCP, third-party clients, and deployed behavior remain unverified. A process failure after a domain change commits but before its idempotent result is cached can require manual reconciliation.
