# Mentingo MCP Authoring Business Spec

## Business Overview

Mentingo MCP lets content creators maintain training from a conversation with their connected AI assistant. An editor can ask for a new onboarding course, a lesson update, or a change to internal knowledge content, and inspect the saved result in Mentingo.

MCP (Model Context Protocol) is the connection that lets an external assistant discover and use Mentingo's authoring tools. Mentingo provides the content operations; the connected assistant interprets the editor's request and supplies the content. The editor uses their existing account and access.

For HR and L&D teams, this can reduce the manual steps between preparing material and maintaining it in the learning platform. It also lets teams keep using their preferred compatible assistant while Mentingo holds the courses, resources, and publication state.

For connection instructions, example prompts, and a suggested demonstration, see the [MCP authoring guide](../mcp.md).

## Who Uses It

- Course creators build an onboarding draft with chapters and lessons, then review it in Mentingo before publication.
- Editors maintain lessons and supporting files in courses they can edit, so training can reflect updated procedures.
- Category managers organise courses and maintain category translations so authors can classify training consistently.
- Content administrators update knowledge articles, news, Q&A, and development paths within their existing access.

## Feature Functions

- Build and update courses, chapters, content lessons, quizzes, AI Mentor lessons, embedded lessons, and live training lessons.
- Find existing training and inspect its structure before making targeted changes.
- Maintain knowledge articles, news, Q&A, categories, and development paths from a connected assistant.
- Attach supporting files, place lesson resources as previews or downloads, upload video, and import SCORM packages through Mentingo's upload flows.
- Manage course publication, pricing, certificates, and assigned-group deadlines when the editor has the required access.
- Maintain content in the languages available for the target course or editorial resource.
- Connect with explicit account consent and expose tools according to current permissions and enabled tenant features.

## End-User Value

Editors can move from an instruction to a saved training change with fewer manual editing steps. They can review results in the same platform that delivers the training, reuse their existing assistant workflow, and maintain courses alongside knowledge content and supporting resources.

## How It Works

The editor connects their assistant, asks it to inspect the available content, and gives a focused authoring instruction. The assistant calls Mentingo's tools and reports the saved result. The editor opens Mentingo to review the course or editorial content and decides when to publish it.

MCP writes take effect directly; this connection does not create a separate proposal awaiting approval inside Mentingo. To prepare training for review, explicitly request a draft course. Publication behaviour differs across content types: article creation publishes immediately, while news creation defaults to a draft.

The editor adds the remote `https://<tenant-host>/api/mcp` endpoint in a supported MCP client. The client discovers Mentingo's OAuth metadata, registers as a public client, and opens Mentingo's connection page in the web app. The editor signs in with the existing Mentingo browser session and chooses Allow or Deny. The client can omit an explicit scope request; Mentingo assigns the internal `authoring` scope after consent. The client exchanges the one-use authorization code using PKCE. Mentingo stores the resulting opaque access and refresh grants in Redis, bound to the user, tenant, client, resource URL, scope, and expiry.

Each MCP HTTP request validates the access grant, active user and tenant, and resource audience. Mentingo reloads current roles, permissions, and tenant feature switches before advertising tools, then reloads permissions again for each tool call. Domain services still enforce ownership and entity rules. The MCP transport's session ID never serves as an authorization credential.

Mutations that publish, delete, reorder, or change pricing, certificates, or media position check the current entity revision under a tenant-scoped row lock. Destructive calls also require exact title, type, ID, or child-ID confirmation as appropriate. Retried creates and path course additions require an idempotency key scoped to the tenant, user, client, tool, and input. MCP calls record the client, tool, entity ID where available, outcome, and request ID through the existing activity log queue. MCP errors return stable codes, HTTP status, and a readable message without leaking untranslated internal message keys.

The connection page uses Mentingo's web components, tenant platform logo, login background, and theme colors. The API validates the OAuth request, redirects to the web page, and supplies connection details only to the signed-in user for the current tenant. The web page posts the decision to the API, which consumes the one-use consent request and completes the OAuth redirect. The OAuth and `/api/mcp` routes remain Nest controller routes. A dedicated guard checks the MCP bearer token, tenant, and resource before the protocol endpoint uses the official MCP SDK's Node request/response adapter.

Local agents can request a narrow multipart grant for the authoring upload routes, with the target, language where applicable, file name, MIME type, size, and relevant form metadata bound to the grant. The course thumbnail grant also binds the required position. Multipart grants are consumed on one request, and access is rechecked before the file is saved.

Lesson file uploads create a resource before it appears in lesson content. The editor passes the uploaded `resourceId` to `insert_lesson_resource`; the tool verifies access, adds the appropriate content node, and the existing lesson update flow attaches the resource to that lesson. A newly uploaded file therefore need not appear in `list_lesson_resources` before insertion.

The upload tool returns a complete `uploadUrl` built from the tenant URL bound to the MCP connection, plus `uploadRequest` with the HTTP method, Bearer header, multipart `fileField`, and required `fields`. The local agent sends the file bytes to that URL exactly. It lets the HTTP client set the multipart `Content-Type` boundary. The API recognizes prefixed upload Bearer tokens separately from normal app tokens, then rejects a different route, method, tenant, file name, MIME type, size, or bound metadata. A failed or interrupted upload consumes the one-use token; the agent requests a fresh grant before retrying. Legacy `Authorization: Upload` grants remain recognized until they expire.

SCORM grants bind a ZIP file and exact authoring metadata to `POST /api/scorm/course`, `POST /api/scorm/lesson`, or `PATCH /api/scorm/lesson/:lessonId/package`. A multipart course import can bind a thumbnail in the same request. With `transport: "tus"`, the same tools initialize the existing package-only SCORM TUS session and return its complete upload URL, headers, upload ID, and complete URL. Video initialization uses the native provider flow: S3 uploads receive a session-scoped Mentingo Bearer header and a complete URL on the tenant host; Bunny uploads use the provider's returned URL and headers. Resumable grants are bound to the session, expire with it, and recheck tenant, user, current permissions, and target access on each Mentingo request.

## Current Delivery Scope

The implemented tool set has 101 named tools. It covers course discovery, category lookup and management, course creation and updates with the native API schemas, course settings and publication/pricing/certificate/media changes, group assignment deadlines, chapter and lesson discovery, ordering and deletion, content, quiz, AI Mentor, embed, and live training lesson creation and edits, lesson resource discovery, placement and detachment, Q&A entry CRUD, article section and published article/content edits, draft and published news discovery and edits, development path metadata, certificate settings and course ordering, multipart authoring uploads, resumable video uploads, and SCORM course/lesson imports through multipart or TUS. Article creation through MCP follows the existing web API: it immediately publishes an article with the default title and empty content. The agent then calls `update_article` to fill it in. News creation defaults to a draft, while development path creation accepts the statuses supported by its API. Article and news updates can set public visibility. SCORM creation and package attachment complete when the local agent sends the ZIP through the existing API route.

## Key Technical Context

- The backend lives in `apps/api/src/mcp`, with the public transport at `https://<tenant-host>/api/mcp`, OAuth endpoints at `/api/oauth/*`, and metadata at `/.well-known/oauth-*`.
- The resource URL is derived from the active tenant host; production tenant hosts require HTTPS. A token presented on another tenant host is rejected.
- The authorization library handles authorization code exchange and PKCE. Mentingo supplies the consent UI, client registry, Redis grant storage, and existing sign-in identity.
- The connection screen is the web route `/oauth/connect`; its consent details come from `/api/oauth/consent/:consent`, while the API remains responsible for approval and denial.
- The adapter calls existing domain services inside tenant RLS context and uses permissions from `@repo/shared`. It does not use the integration admin API key.
- Changes are persisted through existing domain services and their outbox, search, and resource behavior where those services provide it.

## Test Evidence

Repository unit tests cover OAuth tenant/client matching, consent details and preservation of consent when a browser session is invalid; selected MCP/REST permission parity; scoped upload metadata and one-use grant consumption; and lesson-resource rendering and supported preview/download modes.

These are focused unit tests, not proof of a complete external-client workflow. No MCP-specific browser E2E spec was found during this documentation review. The review did not run browser consent, authenticated tool calls, real uploads, or client compatibility checks. The demo in the guide is a proposed walkthrough, not a recorded successful run.

Revision checks protect updates that accept an expected revision, including content-lesson edits. After a conflict, the assistant must reload the target before retrying. A process failure after a domain change commits but before its idempotent result is cached can require manual reconciliation.
