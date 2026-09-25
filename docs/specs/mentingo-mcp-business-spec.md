# Mentingo MCP Authoring Business Spec

## Business Overview

Mentingo MCP lets an authorized content editor connect an AI assistant such as Codex or Claude to Mentingo and ask it to make focused authoring changes. The assistant works with the editor's current Mentingo access, so it can help prepare training content without a separate AI authoring session inside the product.

For HR and L&D teams, this makes routine course maintenance and editorial updates possible from a conversation while Mentingo remains the source of truth for ownership, permissions, languages, and published content.

## Who Uses It

- Course creators maintain courses, chapters, and content lessons they are allowed to edit.
- Category managers create and translate course categories so authors can classify training consistently.
- Content administrators work with knowledge articles, news, Q&A, and development paths according to their current Mentingo permissions.
- Platform administrators configure the public MCP URL and review the connection before enabling it for a tenant.

## Feature Functions

- Connect an MCP client through a Mentingo OAuth authorization code flow with PKCE and explicit consent.
- Discover only the MCP tools allowed by the editor's current permissions and enabled tenant features, then call direct authoring operations on existing Mentingo domain services.
- Find courses, categories, chapters, lessons, article sections, articles, Q&A entries, draft or published news, and development paths by IDs returned from Mentingo.
- Create or update a course with the same fields accepted by Mentingo's course API, then manage categories and their translations, behavior settings, publication, pricing, certificates, chapters, lessons, Q&A entries, published articles, news drafts, and development paths through the existing authoring services.
- Review group assignments for a course and set or clear each assigned group's deadline while keeping its mandatory setting and calendar events in sync.
- Reorder and delete chapters or lessons with an exact revision and affected-content confirmation. List and detach authorized lesson resources.
- Request scoped multipart grants for lesson/article/news attachments, localized article/news covers, course and development path images or signatures, AI Mentor avatars, and course or quiz images before their entity exists; place uploaded lesson files as previews or downloads without writing editor markup by hand.
- Initialize native resumable video uploads for course trailers or authoring attachments and poll their processing status.
- Prepare a SCORM course or lesson import using either the native multipart route or the resumable TUS route; attach another locale's package through the same choice.

## End-User Value

An editor can ask an assistant to make a group of small, precise content changes and then inspect the results in Mentingo. The same permissions and tenant boundaries still apply when an assistant acts for the user. Consent identifies the connecting client before a token is issued.

## How It Works

The editor adds the remote `https://<tenant-host>/api/mcp` endpoint in a supported MCP client. The client discovers Mentingo's OAuth metadata, registers as a public client, and opens Mentingo's connection page in the web app. The editor signs in with the existing Mentingo browser session and chooses Allow or Deny. The client can omit an explicit scope request; Mentingo assigns the internal `authoring` scope after consent. The client exchanges the one-use authorization code using PKCE. Mentingo stores the resulting opaque access and refresh grants in Redis, bound to the user, tenant, client, resource URL, scope, and expiry.

Each MCP HTTP request validates the access grant, active user and tenant, and resource audience. Mentingo reloads current roles, permissions, and tenant feature switches before advertising tools, then reloads permissions again for each tool call. Domain services still enforce ownership and entity rules. The MCP transport's session ID never serves as an authorization credential.

Mutations that publish, delete, reorder, or change pricing, certificates, or media position check the current entity revision under a tenant-scoped row lock. Destructive calls also require exact title, type, ID, or child-ID confirmation as appropriate. Retried creates and path course additions require an idempotency key scoped to the tenant, user, client, tool, and input. MCP calls record the client, tool, entity ID where available, outcome, and request ID through the existing activity log queue. MCP errors return stable codes, HTTP status, and a readable message without leaking untranslated internal message keys.

The connection page uses Mentingo's web components, tenant platform logo, login background, and theme colors. The API validates the OAuth request, redirects to the web page, and supplies connection details only to the signed-in user for the current tenant. The web page posts the decision to the API, which consumes the one-use consent request and completes the OAuth redirect. The OAuth and `/api/mcp` routes remain Nest controller routes. A dedicated guard checks the MCP bearer token, tenant, and resource before the protocol endpoint uses the official MCP SDK's Node request/response adapter.

Local agents can request a narrow multipart grant for the authoring upload routes, with the target, language where applicable, file name, MIME type, size, and relevant form metadata bound to the grant. The course thumbnail grant also binds the required position. Multipart grants are consumed on one request, and access is rechecked before the file is saved.

Lesson file uploads create a resource before it appears in lesson content. The editor passes the uploaded `resourceId` to `insert_lesson_resource`; the tool verifies access, adds the appropriate content node, and the existing lesson update flow attaches the resource to that lesson. A newly uploaded file therefore need not appear in `list_lesson_resources` before insertion.

The upload tool returns a complete `uploadUrl` built from the tenant URL bound to the MCP connection, plus `uploadRequest` with the HTTP method, Bearer header, multipart `fileField`, and required `fields`. The local agent sends the file bytes to that URL exactly. It lets the HTTP client set the multipart `Content-Type` boundary. The API recognizes prefixed upload Bearer tokens separately from normal app tokens, then rejects a different route, method, tenant, file name, MIME type, size, or bound metadata. A failed or interrupted upload consumes the one-use token; the agent requests a fresh grant before retrying. Legacy `Authorization: Upload` grants remain recognized until they expire.

SCORM grants bind a ZIP file and exact authoring metadata to `POST /api/scorm/course`, `POST /api/scorm/lesson`, or `PATCH /api/scorm/lesson/:lessonId/package`. A multipart course import can bind a thumbnail in the same request. With `transport: "tus"`, the same tools initialize the existing package-only SCORM TUS session and return its complete upload URL, headers, upload ID, and complete URL. Video initialization uses the native provider flow: S3 uploads receive a session-scoped Mentingo Bearer header and a complete URL on the tenant host; Bunny uploads use the provider's returned URL and headers. Resumable grants are bound to the session, expire with it, and recheck tenant, user, current permissions, and target access on each Mentingo request.

## Current Delivery Scope

The implemented tool set has 101 named tools. It covers course discovery, category lookup and management, course creation and updates with the native API schemas, course settings and publication/pricing/certificate/media changes, group assignment deadlines, chapter and lesson discovery, ordering and deletion, content, quiz, AI Mentor, embed, and live training lesson creation and edits, lesson resource discovery, placement and detachment, Q&A entry CRUD, article section and published article/content edits, draft and published news discovery and edits, development path metadata, certificate settings and course ordering, multipart authoring uploads, resumable video uploads, and SCORM course/lesson imports through multipart or TUS. Article creation through MCP follows the existing web API: it immediately publishes an article with the default title and empty content. The agent then calls `update_article` to fill it in. News creation defaults to a draft, while development path creation accepts the statuses supported by its API. Article and news updates can set public visibility. SCORM creation and package attachment complete when the local agent sends the ZIP through the existing API route. The complete proposed catalog is in `docs/plans/issue-1991-mentingo-mcp-tool-catalog.md`.

## Key Technical Context

- The backend lives in `apps/api/src/mcp`, with the public transport at `https://<tenant-host>/api/mcp`, OAuth endpoints at `/api/oauth/*`, and metadata at `/.well-known/oauth-*`.
- The resource URL is derived from the active tenant host; production tenant hosts require HTTPS. A token presented on another tenant host is rejected.
- The authorization library handles authorization code exchange and PKCE. Mentingo supplies the consent UI, client registry, Redis grant storage, and existing sign-in identity.
- The connection screen is the web route `/oauth/connect`; its consent details come from `/api/oauth/consent/:consent`, while the API remains responsible for approval and denial.
- The adapter calls existing domain services inside tenant RLS context and uses permissions from `@repo/shared`. It does not use the integration admin API key.
- Changes are persisted through existing domain services and their outbox, search, and resource behavior where those services provide it.

## Validation Boundary

This implementation has been typechecked and linted locally. Focused tests cover generic and SCORM multipart grant matching and upload input validation. OAuth discovery and dynamic client registration have been exercised against the local tenant API through Caddy. Browser consent, authenticated MCP tool calls, Claude OAuth, and real uploads have not yet been exercised. Revision checks are in place for the newer status, pricing, media, ordering, deletion, and resource detachment tools; older metadata and editorial mutations do not yet all require a revision. The Redis idempotency reservation prevents automatic duplicate execution on a pending key, but a process failure after a domain commit and before result caching requires manual reconciliation.
