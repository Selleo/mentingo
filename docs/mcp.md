# Author training from your AI assistant

Mentingo MCP lets you ask a connected AI assistant to create and maintain training directly in Mentingo. For example, a course creator can build an onboarding draft with chapters and lessons, inspect the result in Mentingo, and publish it after review.

MCP (Model Context Protocol) connects the assistant to Mentingo's authoring tools. Your assistant interprets your request and prepares the content; Mentingo stores the result and enforces access to your organisation's content.

## What you can do

- Create and update courses, chapters, lessons, quizzes, and AI Mentor practice lessons.
- Inspect existing training before changing its content or structure.
- Maintain knowledge articles, news, Q&A, categories, and development paths.
- Attach supporting files, upload video, and import SCORM packages through the existing upload flows.
- Manage course publication, certificates, pricing, and assigned-group deadlines when your account permits it.

The tools available to you depend on your current permissions and the features enabled for your organisation. A connection does not grant additional access.

## Connect to Mentingo

You need an active Mentingo account on a deployment containing the MCP feature, the organisation's tenant URL, and a client that supports remote MCP over Streamable HTTP with OAuth authorization-code authentication, PKCE, and dynamic client registration. This guide describes Mentingo's connection flow; it does not certify a particular client or version.

1. In your client's remote MCP connection settings, add a connection named **Mentingo** with this URL:

   ```text
   https://<tenant-host>/api/mcp
   ```

   Replace `<tenant-host>` with your organisation's Mentingo host. Use the full endpoint, including `/api/mcp`.

2. Start the client's authentication flow. It discovers Mentingo's OAuth metadata and opens the Mentingo connection page.
3. Sign in to the correct Mentingo account if needed. If the connection page asks you to sign in, complete sign-in and restart the connection from your client.
4. Review the client name, signed-in account, and redirect address. Choose **Allow** to connect or **Deny** to cancel.
5. Return to the assistant and ask:

   > Show my available Mentingo capabilities. Do not change any content.

   The assistant can use `get_my_capabilities` to report your current access. Ask it to list the courses you can manage if course discovery is available.

Authentication uses your Mentingo account. You do not need to paste an integration administrator API key into the assistant. Use your client's disconnect controls when finished; clients that support token revocation can use Mentingo's OAuth revocation endpoint.

## First authoring task

Use a new draft course for your first walkthrough. Course creation and editing permissions are both needed to build its chapters and lessons.

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

The flow above is based on the MCP implementation and consent UI on staging. Repository unit tests cover selected OAuth, permission, upload, and resource-rendering behaviour. This documentation change does not validate production availability, compatibility with a named client, or the complete browser-to-authoring workflow.

For scope, source references, and test boundaries, see the [Mentingo MCP business spec](specs/mentingo-mcp-business-spec.md).
