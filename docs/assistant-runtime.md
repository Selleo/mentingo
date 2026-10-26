# Core Assistant runtime

The Assistant runs in the Core API using AI SDK Workflow and self-hosted Postgres World. Core stores user-visible threads, messages, ownership and run status; Workflow stores durable execution. The browser uses authenticated Core endpoints and polls persisted response checkpoints while a run is active.

## Configuration and startup

1. Apply normal Core migrations with `pnpm --filter api db:migrate` using the intended environment context.
2. Provision a dedicated empty PostgreSQL database for Workflow. It may use the same PostgreSQL server as Core, but **must not use the Core database**: upstream Workflow migrations own public enum names that conflict with Core.
3. Set `WORKFLOW_POSTGRES_URL` through the deployment's private configuration. Run `pnpm --filter api workflow:bootstrap` in that same environment. The wrapper refuses an application database before running upstream migrations.
4. Build with `pnpm --filter api build`, then start the API through the existing deployment command. Development startup rebuilds the Workflow bundle when Workflow is configured.

An absent Workflow URL leaves Assistant execution unavailable without preventing ordinary API startup. An invalid configured database or missing production bundle fails startup visibly. No public Workflow execution endpoint or hosted Workflow service is required. Workflow jobs execute in the API process, so an API instance must remain running to process them.

The runtime resolves model/provider credentials through Core's existing tenant-aware AI runtime. It uses the existing Langfuse/OpenTelemetry configuration, with one assistant run trace, user identity and thread session identity. Local trace assertions do not establish remote Langfuse delivery.

## Access and lifecycle

The existing application login authenticates Assistant requests; users do not connect OAuth or Slack accounts. Every active authenticated user can access the feature, including custom roles; existing domain permissions determine each tool's readable content. Every thread operation checks tenant and owner. Tool execution rechecks account state and permissions, including after queue delays. The native read-tool allowlist reuses MCP authorization callbacks without creating an OAuth token.

Administrative AI Conversations uses the separate `ai_thread.read` permission. Personal thread ownership therefore does not imply that conversations are hidden from authorized administrators.

Client message IDs deduplicate sends. Active runs prevent overlapping messages within a thread; cancellation preserves already saved text and permits a new message. Stable Workflow run IDs and pending handoff recovery prevent an ordinary request retry from creating duplicate execution. Assistant responses expose only links derived from authorized tool evidence. Verified destinations appear inline in the answer with hover previews; no separate Sources list duplicates them.

The web app remembers a selected nonarchived conversation ID in sessionStorage, scoped to origin, account and explicit support tenant when present. Returning to /assistant validates that pointer through the ordinary thread API before navigating. New conversation clears it. Transcript content remains server-side; restoring a thread never sends another message or restarts generation.

## Current verification and scope

Database-backed HTTP tests cover ownership, tenant isolation, administrative access, idempotency, cancellation, archive behavior and unavailable execution. Deterministic Postgres Workflow smoke tests cover model/tool steps, partial text checkpoints and completion. Browser fixture checks cover desktop/mobile presentation. Live model behavior, remote tracing delivery and production deployment require environment-specific checks.

V1 provides read-only conversations and source links. Contextual mini-chat, report changes and live editable artifacts are future work. Core owns those user-facing contracts so execution can evolve independently.
