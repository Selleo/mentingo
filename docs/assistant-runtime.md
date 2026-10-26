# Core Assistant runtime

The Assistant runs in the Core API using AI SDK Workflow and self-hosted Postgres World. Core stores user-visible threads, messages, ownership and run status; Workflow stores durable execution. The browser uses authenticated Core endpoints and polls persisted response checkpoints while a run is active.

## Configuration and startup

1. Apply normal Core migrations with `pnpm --filter api db:migrate` using the intended environment context.
2. Use the existing Core PostgreSQL database. Workflow owns the `workflow` schema for its data and enums, `workflow_drizzle` for SDK migration tracking, and `graphile_worker` for its queue. Core tables and tenant RLS stay in `public`.
3. Set `WORKFLOW_POSTGRES_URL` explicitly to that same database through private configuration; it enables the Assistant runtime and uses its own connection pool. Run `pnpm --filter api exec bootstrap` once with a setup role allowed to create the three SDK schemas before starting API instances. Use a dedicated runtime role with access only to the SDK objects, not Core tables. Graphile Worker uses internal RLS without ordinary-role policies, so table DML grants alone are insufficient: the runtime role must own the `graphile_worker` schema and its tables. A dedicated SDK owner can create/own all three SDK schemas during bootstrap without owning Core objects; database-level schema-creation privilege can be granted for setup and revoked afterwards. The upstream CLI falls back to `DATABASE_URL` when `WORKFLOW_POSTGRES_URL` is absent, so set the intended connection explicitly. SDK migrations are tracked separately from Core migrations.
4. Build with `pnpm --filter api build`, then start the API through the existing deployment command. Development startup rebuilds the Workflow bundle when Workflow is configured.

If an environment already uses a separate Workflow database, drain its active workflows before switching the connection. Bootstrap the Core database first; changing the URL does not transfer pending jobs or durable Workflow history. Existing Core conversation records remain in Core. Keep the old database until its history is no longer needed.

The unreleased Assistant migrations are consolidated into `0224_core_assistant` (tables, columns and indexes) and `0225_enable_assistant_tenant_rls` (tenant policies). A local database that already applied the earlier four-migration development history must be recreated or explicitly reconciled before using this history; do not rerun the squashed migrations against it blindly.

An absent Workflow URL leaves Assistant execution unavailable without preventing ordinary API startup. An invalid configured database or missing production bundle fails startup visibly. No public Workflow execution endpoint or hosted Workflow service is required. Workflow jobs execute in the API process, so an API instance must remain running to process them.

The pinned `@workflow/world-postgres@5.0.5` dependency has a pnpm patch that qualifies the enums in historical migrations `0000`, `0004`, `0005` and `0007` with `workflow`. Unpatched bootstrap creates and drops `public.status`, colliding with Core course status. `search_path` cannot fix explicit schema references. The patch changes only the upstream SQL migration payload, not Core tables or runtime queries; install through the committed lockfile before bootstrap. Revalidate fresh setup, re-bootstrap and existing Workflow migration history when updating the SDK. Do not apply unpatched upstream bootstrap to the Core database.

The runtime resolves model/provider credentials through Core's existing tenant-aware AI runtime. It uses the existing Langfuse/OpenTelemetry configuration, with one assistant run trace, user identity and thread session identity. Local trace assertions do not establish remote Langfuse delivery.

## Access and lifecycle

The existing application login authenticates Assistant requests; users do not connect OAuth or Slack accounts. Every active authenticated user can access the feature, including custom roles; existing domain permissions determine each tool's readable content. Every thread operation checks tenant and owner. Tool execution rechecks account state and permissions, including after queue delays. The native read-tool allowlist reuses MCP authorization callbacks without creating an OAuth token.

Administrative AI Conversations uses the separate `ai_thread.read` permission. Personal thread ownership therefore does not imply that conversations are hidden from authorized administrators.

Client message IDs deduplicate sends. Active runs prevent overlapping messages within a thread; cancellation preserves already saved text and permits a new message. Stable Workflow run IDs and pending handoff recovery prevent an ordinary request retry from creating duplicate execution. Assistant responses expose only links derived from authorized tool evidence. Verified destinations appear inline in the answer with hover previews; no separate Sources list duplicates them.

The web app remembers a selected nonarchived conversation ID in sessionStorage, scoped to origin, account and explicit support tenant when present. Returning to /assistant validates that pointer through the ordinary thread API before navigating. New conversation clears it. Transcript content remains server-side; restoring a thread never sends another message or restarts generation.

## Current verification and scope

Run the isolated storage regression with `pnpm --filter api exec jest --config test/jest-workflow-postgres.json --runInBand` (Node 22 and Docker required). It owns and removes a disposable PostgreSQL container, never uses existing database URLs, reproduces the unpatched collision, and verifies patched fresh bootstrap, reruns, legacy migration upgrades and real queue processing. Core-like enum definitions, object identities, schema and records remain unchanged. Queue processing also passes with a non-superuser Graphile-owner role denied Core table access. These fixtures do not represent a full production database migration rehearsal.

Database-backed HTTP tests cover ownership, tenant isolation, administrative access, idempotency, cancellation, archive behavior and unavailable execution. Prior deterministic Postgres Workflow smoke tests covered model/tool steps, partial text checkpoints and completion. Browser fixture checks cover desktop/mobile presentation. Live model behavior, remote tracing delivery and production deployment require environment-specific checks.

V1 provides read-only conversations and source links. Contextual mini-chat, report changes and live editable artifacts are future work. Core owns those user-facing contracts so execution can evolve independently.

## Pre-PR security hardening

Assistant query caches are scoped by account, origin and support tenant. Logout invalidates pending requests and mutations so delayed results cannot repopulate another authenticated session. Background execution rechecks the tenant status as well as account and tool permissions; suspension permanently fails the current run.

Every recovery tick also reconciles bounded batches of stale, already-bound runs against Workflow state. Confirmed missing, failed or cancelled workflows become terminal in Core, retaining partial output; transient World errors leave runs retryable. Keyset pagination prevents older live runs from starving later failures.

The staging-based review includes regression coverage for these boundaries and preserves the staging route guard. This is not a claim that the repository has no vulnerabilities: existing dependency advisories require separate triage. Live provider behavior, remote Langfuse delivery, real microphone transcription and deployed restart/recovery still need environment-specific verification.
