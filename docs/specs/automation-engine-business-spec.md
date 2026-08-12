# Automation engine business specification

## Purpose

The automation engine lets tenant administrators define event-triggered workflows that resolve users and course context, render a system or tenant email template, and deliver the message to the resolved recipients. Automations are tenant-scoped and are available only to administrators with `AUTOMATION_MANAGE`.

## Actors and access

- An automation administrator can list, create, edit, simulate, enable, disable, archive, seed defaults, inspect logs, and delete automations for the current tenant.
- The API derives tenant scope from the authenticated request and database tenant context. A client cannot select another tenant through an automation record or step payload.
- The web route, navigation group, and API endpoints use the same `AUTOMATION_MANAGE` permission. Frontend visibility is a convenience; API authorization remains authoritative.

## Automation lifecycle

An automation has one of four states:

- `draft`: incomplete or changed since its last successful simulation; it must not run.
- `enabled`: validated and eligible to run when its trigger event occurs.
- `disabled`: intentionally paused while retaining its configured tree.
- `archived`: retained for history and unavailable for activation.

Editing the tree or action configuration returns the automation to `draft`. Enabling requires a connected valid tree and a successful simulation. Disabling pauses delivery without deleting the tree.

## Workflow model

Each automation stores a single connected step tree:

1. Exactly one trigger node is the root.
2. Action and condition nodes are descendants of the root.
3. Every node ID is unique and every non-root parent belongs to the same submitted tree and automation.
4. Cycles, disconnected nodes, missing parents, duplicate IDs, and cross-automation IDs are rejected by the API.
5. A step’s `typeContext` contains the node name, display label, supported variables, configuration, and canvas position.

The server validates and persists the complete tree in the same transaction as metadata when the builder saves. The builder may provide faster client-side validation, but server validation is authoritative.

## Execution

When a supported domain event is published, the API finds enabled automations whose trigger name exactly matches the event identifier. The runner:

1. Loads the automation and derives the tenant from that record.
2. Skips and logs disabled, draft, archived, empty, or invalid automation trees.
3. Resolves recipients and preserves each recipient’s user ID, tenant ID, email, and event variables.
4. Resolves `user_default` language from the recipient’s supported user setting, with English fallback.
5. Resolves announcement and other localized values using the recipient language and the repository fallback policy.
6. Renders system or tenant email templates with tenant branding, logo support, subject, HTML, and plain-text content.
7. Enqueues one email-delivery job per recipient. Jobs use retry with exponential backoff and a deterministic automation/event/recipient key to reduce duplicate queue entries.

The event handler remains bounded to resolution, validation, rendering, and enqueueing. The worker performs the external email send and records terminal recipient failures in tenant-scoped automation logs.

## Templates and localization

System templates are selected from the supported automation template registry. Custom templates are loaded through the email-notification-template service and rendered with the tenant primary color and logo source. Placeholder mappings are resolved from the recipient event variables. Every delivery includes a real text fallback derived from the rendered HTML.

Localized metadata is merged by the API so editing one language does not remove other language keys. The admin list displays the selected application language and falls back to the first available localized value when a translation is missing.

## Default automations

Default seeding is tenant-scoped and batch-reads existing trigger names. Existing trigger types are reported as skipped. Creation failures are reported separately from skips, and a partially created automation is removed when its step creation fails. A tenant-scoped unique trigger index prevents concurrent seed requests from creating duplicate trigger workflows.

## Save and failure behavior

- Metadata and the complete step tree are saved atomically.
- Empty trees are rejected by the save command.
- The builder awaits save before navigating away and retains dirty state when save fails.
- Drawer autosave is debounced, serialized with other automation mutations, flushed when the drawer unmounts, and does not show a success toast for every edit.
- A queued email is considered accepted by the automation run; later worker failures are visible as failed recipient log entries and are retried according to the queue policy.
- Missing templates, rendering failures, invalid trees, and recipient delivery failures are logged with the automation and affected email address where available.

## Admin UI requirements

The list supports search and status filtering, the drawer exposes localized metadata and lifecycle actions, and the builder provides explicit save, simulation, activation, pause, delete, and leave-without-saving actions. The action editor stacks its configuration and preview panes on narrow screens while keeping the footer actions accessible.

The UI must use the same lifecycle vocabulary as the API and must not represent a paused automation as a draft. A user should be able to identify whether changes are saved, pending, or failed and recover without losing the current graph.

## Observability and validation

Automation logs record the automation, event, status, recipient addresses, and error name. Focused tests should cover permission denial, tenant isolation, tree invariants, atomic-save failure, exact trigger matching, default-seed races/failures, localized branded rendering, queue retry/idempotency, and the builder’s save/recovery lifecycle.
