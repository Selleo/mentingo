# AI Conversations

## Business Overview

AI Conversations gives tenant administrators one place to review learner conversations across course AI Mentor lessons, standalone Practice sessions, the Mentingo Assistant, and connected external assistant threads. Administrators can identify who took part, understand the training context, read the conversation, and inspect its saved evaluation.

The workflow supports HR and L&D review of how learners practice and where they struggle. Historical attempts remain separate so an administrator can inspect the conversation associated with a particular result.

## Who Uses It

- Tenant administrators review learner conversations within their organization to understand practice activity and evaluate training outcomes.

## Feature Functions

- Browse paginated Practice, AI Mentor lesson, Assistant, and connected external assistant conversations in one inbox.
- Recognize an external conversation’s platform by its icon and read each participant’s name alongside their messages.
- Filter by conversation type, status, start date, and title.
- Identify the conversation owner and its practice or course/lesson context.
- Read retained messages and saved voice transcripts in chronological order.
- Inspect a conversation's saved evaluation, including scores and feedback where available.
- Review archived attempts alongside current and completed conversations.
- Preserve future completed practice attempts when a learner starts a replay.

## End-User Value

Administrators can review learning conversations without navigating through individual course statistics. A shared view of the learner, training context, transcript, and result makes it easier to understand outcomes and discuss improvement. Preserved attempts support comparison over time.

## How It Works

An administrator opens AI Conversations, searches or filters the left-hand conversation list, and selects a conversation to read alongside it. Optional details show the learner, training context, dates, status and saved evaluation without cluttering the transcript. On mobile, selecting a conversation replaces the list and Back restores it. Selection and navigation preserve the list filters and page.

Conversation titles come from the practice or lesson title, with an opening-message fallback. External assistant threads appear with a platform icon for Slack, Discord, or WhatsApp. Each external message shows its sender’s name, with their platform participant ID as a fallback when a name cannot be resolved. The connected Mentingo account is labeled separately from conversation participants. Slack is the sending integration implemented alongside this feature; Discord and WhatsApp source support does not include deployed bots. The owner, status, and last activity help distinguish similar sessions in the list; the Details tab provides their training context and saved evaluation. Results are read from the selected attempt rather than generated again during review.

Reviewing a conversation does not interrupt the learner or change their session. Administrators cannot send messages, replay, grade, archive, or delete conversations from this view.

## Access and Business Rules

- Only tenant administrators can review conversations, and only within their own organization.
- Practice sessions, course AI Mentor lessons, Assistant conversations, and explicitly synced external assistant threads are included. Current, completed and archived attempts can be reviewed.
- Each attempt retains its own conversation and saved evaluation. Reviewing an attempt does not generate a new evaluation or change the learner's result.
- Conversation text and evaluation feedback remain in the language in which they were recorded.
- External participants use the integration’s paired Mentingo account’s access to content. Their platform identities identify who wrote a message; they do not grant Mentingo access or establish a link to individual Mentingo accounts.
- Transcript syncing requires both the connected account’s OAuth token and a request signature from the configured external assistant. A student token alone cannot publish transcripts. Each connected Core instance configures the bot’s public verification key; the bot retains its private signing key.
- Transcript syncing is explicit. Ordinary MCP tool calls do not create AI Conversations. Slack names require the Slack bot’s `users:read` permission; missing names fall back to participant IDs.
- Future practice replays preserve the previous attempt. Attempts deleted before history preservation was introduced cannot be recovered.

## Key Technical Context

- The review route is `/admin/ai-conversations`, protected by the existing AI conversation review permission and tenant scoping.
- External assistant transcripts retain their source and per-message sender identity. The account connected to the external assistant remains the conversation owner for access and filtering.
- `AiConversations.page.tsx`, `ConversationReader.tsx`, and `ConversationDetails.tsx` display the external source and participant attribution.
- External assistant transcripts are read-only in this review view and have no learning evaluation.

## Test Evidence

Focused frontend tests cover Slack, Discord, and WhatsApp markers in the inbox and reader, sender names, participant ID fallback, and an unknown-participant fallback. Existing reader tests cover loading, failures, retained messages, evaluation details, and navigation. These are component tests with mocked API responses; they do not prove live Slack OAuth grants or transcript delivery from a deployed bot. Offline cryptographic tests verify bot signatures, token and destination binding, payload integrity, and timestamp rejection. Live end-to-end Slack delivery remains an integration verification step.
