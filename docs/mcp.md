# Connect your AI assistant to Mentingo

Mentingo MCP (Model Context Protocol) gives a connected AI assistant access to many of Mentingo's tools. Ask it to find or manage courses, lessons, categories, articles, news, Q&A, learning paths, and supported files from the assistant you already use. Mentingo saves changes under your account and permissions, and remains the place to review training and content.

## What you can do

- Create and update courses, chapters, lessons, quizzes, and AI Mentor practice lessons.
- Inspect existing training before changing its content or structure.
- Maintain knowledge articles, news, Q&A, categories, and development paths.
- Attach supporting files, upload video, and import SCORM packages through the existing upload flows.
- Manage course publication, certificates, pricing, and assigned-group deadlines when your account permits it.

The tools available to you depend on explicitly approved OAuth scopes, your current account permissions, and the features enabled for your organisation. A connection does not grant additional access. Learner integrations can use `student:read` to search and read a limited student view without content management or administration.

## Connect to Mentingo

You need an active Mentingo account on a deployment containing the MCP feature, the organisation's tenant URL, and a client that supports remote MCP over Streamable HTTP with OAuth authorization-code authentication, PKCE, and dynamic client registration. This guide describes Mentingo's connection flow; it does not certify a particular client or version.

Replace `<tenant-host>` below with your organisation's Mentingo host. Use the full endpoint, including `/api/mcp`.

### Claude Code

Register Mentingo with Claude Code:

```sh
claude mcp add --transport http mentingo https://<tenant-host>/api/mcp
```

Before starting OAuth, configure the client to request the explicit scopes needed below. A client must support scope selection; requesting every advertised scope together is invalid because `student:read` is exclusive. Start Claude Code and run `/mcp`, select Mentingo, and follow the browser sign-in and consent flow with those scopes. Check the connection with `claude mcp list`.

### Codex CLI

Register Mentingo:

```sh
codex mcp add mentingo --url https://<tenant-host>/api/mcp
```

Configure the explicit scopes needed below when starting `codex mcp login mentingo`, using the scope option supported by your installed client version. Complete Mentingo sign-in and review the scope list on the consent page, then check the connection with `codex mcp list`. Missing scopes are rejected rather than defaulted to authoring access.

### Other MCP clients

In your client's remote MCP settings, add a connection named **Mentingo** with this URL:

```text
https://<tenant-host>/api/mcp
```

Choose HTTP/Streamable HTTP transport if the client asks and configure the explicit OAuth scopes for the intended workflow. Start its sign-in flow; it should discover Mentingo's OAuth metadata and open the consent page. Sign in to the correct account, review the client and redirect address, then choose **Allow**.

Authentication uses your Mentingo account. You do not need to paste an integration administrator API key into the assistant. Use your client's disconnect controls when finished; clients that support token revocation can use Mentingo's OAuth revocation endpoint.

## Explicit connection scopes

New connections must request a nonempty, explicit set of scopes. There is no default
`authoring` scope. OAuth discovery advertises only the requestable scopes below, and
the consent page lists the exact scopes before approval. Unknown, duplicate or omitted
scopes are rejected. Read and write scopes are separate: a write scope does not
implicitly include its read counterpart.

| Scope                                         | Intended access                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `student:read`                                | Exclusive learner search and the eight learner list/get tools below                                                          |
| `search:read`                                 | Existing global search with current account permissions, including administrative groups where permitted; not a student view |
| `courses:read`, `courses:write`               | Course, chapter and lesson management reads or mutations                                                                     |
| `categories:read`, `categories:write`         | Category management reads or mutations                                                                                       |
| `articles:read`, `articles:write`             | Article/section management reads or mutations                                                                                |
| `news:read`, `news:write`                     | News management reads or mutations                                                                                           |
| `qa:read`, `qa:write`                         | Q&A management reads or mutations                                                                                            |
| `learning_paths:read`, `learning_paths:write` | Development path management reads or mutations                                                                               |
| `users:read`, `users:write`                   | Supported existing-user and own-profile reads or mutations                                                                   |
| `groups:read`, `groups:write`                 | Supported group reads or mutations                                                                                           |
| `platform:read`, `platform:write`             | Platform customization reads or mutations                                                                                    |
| `files:write`                                 | Supported uploads, still subject to native target/file authorization                                                         |

Management read scopes can expose authoring information, drafts or configuration
when the account's existing permissions allow it. `readOnlyHint` describes whether a
tool mutates data; it does not make its output suitable for students. Use
`student:read` for the Slack assistant. It cannot be combined with any other scope.
Other explicit scopes can be combined, for example `courses:read courses:write` for
course editing. Each tool has an explicit scope mapping; adding a new tool does not
automatically authorize it for an existing connection.

### Existing connections

Existing `authoring` and `search` access and refresh grants keep their previous access
until the user reconnects, subject to normal expiration, revocation and current
permissions. `authoring` retains the existing management catalog; `search` retains
only `global_search` and its previous content projection. Neither legacy grant gains
the new student tools. New authorization and consent requests cannot request these
legacy scope names, and a missing scope never creates a legacy grant.

Refreshing or exchanging an authorization code cannot change its approved scope set.
Changing from a legacy scope, adding explicit scopes, or switching to `student:read`
requires a fresh authorization and consent flow. Legacy access is preserved; it is
not silently converted into student access.

## Student integrations

A `student:read` connection discovers `global_search` and these reader equivalents,
subject to current account permissions and enabled tenant features:

| Tools                                             | Returned data                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `list_student_courses`, `get_student_course`      | Available/enrolled course metadata: title, description, category, enrollment, chapter count, price/currency and source link |
| `list_student_articles`, `get_student_article`    | Published, unarchived articles in an available language; list metadata and bounded article text                             |
| `list_student_news`, `get_student_news`           | Published learner-visible news in an available language; list metadata and bounded news text                                |
| `list_student_qa_entries`, `get_student_qa_entry` | Learner-visible Q&A available in the requested language; list titles and bounded answers                                    |

Mentingo intersects the connected account's **current** permissions with the default
student permission set; it never grants a missing permission or impersonates another
student. Elevated role shortcuts are excluded. Course detail explicitly rejects
drafts, archived courses and unenrolled private courses, including courses authored
by the connected account. Course results never contain chapter/lesson bodies,
assessments, internal authoring settings, private files or signed download URLs.

Article, news and Q&A details contain sanitized original text only, capped at 16,000
characters with `contentTruncated`. Resource objects, injected signed URLs, HTML
attributes and active HTML are excluded. Titles are capped at 500 characters and
summaries/course descriptions at 2,000. Lists return bounded pages: courses, articles
and Q&A accept `pageSize` up to 25; news uses the existing learner API's fixed page
size. List queries filter titles where supported. No upload or mutation tools are
available, and direct calls to tools outside the scope are rejected.

A Slack workspace pairs to one Mentingo account. Every participant shares that
account's learner visibility and enrollments; this does not provide each Slack
participant's personal Mentingo permissions. Individual account linking would be
required for personal enrollment isolation.

### Student search and links

Student search is restricted before retrieval to accessible course metadata, news,
articles and Q&A. It excludes lesson, directory and development-path searches.
Course matching uses title/description documents only, including in hybrid mode;
lesson or private file matches cannot cause a course hit. Course matched passages
and attachment filenames are omitted from returned results. Editorial retrieval
continues to enforce learner publication, language and file visibility rules.

Keyword mode and hybrid mode share permission-filtered full-text retrieval over
indexed metadata and eligible extracted file text. Hybrid adds semantic matching;
keyword mode does not call the embedding provider. Student course metadata limits
apply to both modes. File text must have been indexed by the background process, and
file matches do not produce download access or invented file URLs.

MCP search and student read results include canonical `url` fields using the tenant
bound to the OAuth resource. Courses link to `/course/<id>`, articles to
`/articles/<id>`, news to `/news/<id>`, and Q&A to `/qa?qaId=<id>`. The model can cite
these links without guessing routes or tenant hosts. Opening a link still requires
the viewer's own normal Mentingo login and access checks. These MCP projections do
not change the REST response shape.

## Check your access

After connecting, return to the assistant and ask:

> Show my available Mentingo capabilities. Do not change any content.

For management connections, the assistant can use `get_my_capabilities` when the approved scope set exposes it. A student or search-only connection instead uses its discovered tools; for `student:read`, ask it to list available or enrolled courses. Missing tools can reflect the approved scopes as well as account permissions and enabled features.

## Try a first task

Use a management connection with explicit `courses:read courses:write` scopes and a new draft course for your first walkthrough. Course creation and editing permissions are both needed to build its chapters and lessons.

> In Mentingo, create a new draft course named “MCP demo — New starter onboarding”, with English as its base language. Add one chapter named “Your first day” and two content lessons: “Meet the team” and “Working together”. Write a short introduction and three practical tips for each lesson. Do not publish it. Report the course ID and the chapter and lesson IDs you created so I can inspect them in Mentingo.

Open Mentingo's course management area and find the course by the returned title or ID. Check its draft status, chapter order, lesson titles, and lesson content before continuing.

Then try a focused update:

> In the draft course with ID [course ID], inspect “Working together”. Keep its existing content and add a short checklist about preparing for the first team meeting. Keep the course in draft and report what changed.

These prompts are examples of workflows supported by the tool surface. They have not been exercised against a live external client as part of this documentation change.

## Review and publication

Tool calls save changes directly in Mentingo. There is no additional Mentingo proposal approval step for ordinary MCP edits. Asking the assistant to show a plan before making changes is a conversation instruction, rather than a server-enforced approval workflow.

- **Courses:** explicitly ask for draft status while preparing content. Publishing requires a confirmation argument; give the assistant a separate instruction after your review.
- **Articles:** creating an article publishes it immediately with an initial title and empty content. The assistant fills it in through a subsequent update. Use a draft course for a demo that requires unpublished content.
- **News:** creation defaults to a draft.
- **Existing content:** use IDs returned by Mentingo to identify targets. Changes that require a revision must use the current revision; after a conflict, inspect the target again.
- **Languages:** new content lessons use the course's base language. Updates must target a language available in that course.
- **Files:** an upload requires a client or local agent capable of sending file bytes through the returned upload instructions. A lesson resource is placed in the content after upload; requesting an upload alone does not insert it.

## Suggested three-minute demo

This is a recording script to run on a demo tenant after checking the chosen client, rather than evidence of a completed demonstration.

| Moment  | Show                                                       | Explain                                                               |
| ------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Connect | The Mentingo consent screen and account details            | “The assistant acts with this editor's existing access.”              |
| Create  | Run the onboarding draft prompt above                      | “An editor can describe a training task in a conversation.”           |
| Inspect | Open the saved draft, chapter, and two lessons in Mentingo | “The result is training content the team can review in the platform.” |
| Refine  | Run the checklist update and inspect the saved lesson      | “The same connection helps maintain content as procedures change.”    |
| Finish  | Show that the course remains in draft                      | “The editor reviews the result before asking for publication.”        |

Before recording, verify course creation/editing permissions and a successful connection with the chosen client. Use sample content in a demo tenant. After recording, remove the demo course through the normal management workflow if it is no longer needed.

## If something does not work

| Symptom                                      | Next step                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection does not open a consent page      | Check the endpoint, deployment, and client support for the required transport and OAuth flow. Ask the deployment administrator to verify tenant routing. |
| Sign-in or consent request is unavailable    | Sign in to the correct tenant and restart authentication from the client.                                                                                |
| A tool is missing or access is denied        | Ask for your available capabilities. Check account permissions, target ownership, and enabled organisation features.                                     |
| An edit reports a revision conflict          | Reload the target and review its current content before retrying.                                                                                        |
| A file upload fails                          | Follow the returned upload URL, headers, and file metadata. A retry can require a fresh upload grant.                                                    |
| A call fails after it may have saved content | Inspect Mentingo before repeating creation or other changes, to avoid duplicates.                                                                        |

## Validation and further detail

The flow above describes the MCP implementation and consent UI. New student/scope tests have been added but were not run locally for this change; CI is responsible for validation. Repository unit tests cover selected OAuth, permission, upload, and resource-rendering behaviour. This documentation change does not validate production availability, compatibility with a named client, or the complete browser-to-authoring workflow.

For scope, source references, and test boundaries, see the [Mentingo MCP business spec](specs/mentingo-mcp-business-spec.md).
