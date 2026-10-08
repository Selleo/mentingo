# Automations Business Spec

## Business Overview

Automations let organization administrators configure event-driven emails for learners and staff. They reduce repetitive notification work while keeping account-access messages and learning updates tied to the right recipient and published email content.

The Automations workspace brings workflows, reusable workflow templates, email templates, and delivery logs together. Administrators can review a workflow before enabling it and use logs to see what happened after an event.

## Who Uses It

- HR and L&D administrators with automation-management access create and enable notification workflows for their organization.
- Administrators with email-template access prepare localized email content used by workflows.
- Administrators with log access review delivery outcomes when a notification needs investigation.
- Learners and staff receive the resulting course, account-access, and other event emails.

## Feature Functions

- Create and manage event-driven email workflows.
- Start from a workflow template or edit a workflow's steps and recipients.
- Use published built-in or custom email templates for delivery.
- Enable, disable, and archive workflows as needs change.
- Review runs and delivery outcomes in the workspace logs.
- Audit who created, saved a draft, published/applied, activated, deactivated, duplicated, archived, deleted, or simulated a workflow in Activity Logs.
- Protect account-access links when the requested email address changes or a request becomes too old.
- Keep an enabled workflow's published template from being restored into a draft.

## End-User Value

Administrators can maintain timely, relevant communication without sending each message manually. Recipients get messages that reflect current account ownership and approved template content.

## How It Works

An administrator opens the Automations workspace, chooses an event, configures the email steps and recipients, then enables the workflow. Mentingo reacts to matching events, prepares recipient-specific content, and records the outcome for review.

Activity Logs capture changes saved by administrators, including workflow configuration and localized name or description edits. Explicitly saving a draft and publishing/applying it are separate actions. Apply persists current editor changes and publishes them together, recording only the apply event; it does not add a draft-save event. Initial activation can also apply the first draft. Creation from a workflow template identifies that template, and duplication identifies the source workflow. Repeating activation, deactivation, or archiving without a state change creates no additional log.

Simulation entries identify a saved workflow when available and summarize success or validation issues, evaluated steps, and preview counts. Unsaved workflows can also be simulated. Sample values and rendered email content are excluded from simulation logs. Automatic runs and email delivery outcomes remain in the workspace run history.

Account-access emails use short-lived links. If a user's email changes before a queued message is prepared, Mentingo skips the old-address delivery; an already issued automation magic link also stops working after the change. A request that has aged past its lifetime does not gain a new lifetime merely because delivery was delayed.

Custom templates must remain published while an enabled workflow depends on them. Only archived templates can be restored into drafts, and a dependent enabled workflow blocks that restoration.

## Key Technical Context

- The workspace is at `/admin/automations`; its tabs are gated separately by `AUTOMATION_MANAGE`, `EMAIL_TEMPLATE_MANAGE`, and `AUTOMATION_LOG_READ`.
- The API separates workflow management, account-action token preparation, email delivery, and run history. Tenant-scoped database access and the email queue carry the work after an event.
- Magic-link requests retain the requested recipient on the account-action intent; delivery and redemption compare it with the current account email.
- Email-template lifecycle mutations use a shared lock and dependency check to protect enabled workflows.
- Management actions require `AUTOMATION_MANAGE`; viewing the cross-resource activity timeline separately requires `ACTIVITY_LOG_READ`. Automation mutations publish audit events through the existing outbox in their database transaction, and activity handlers preserve event-time names and actual changed values.

## Test Evidence

Focused API service regressions cover old and changed email addresses, request-age expiry, and template restoration restrictions. A backend E2E regression covers rejecting an issued magic link after the account email changes; it has not been run against the shared development database.

Existing web E2E coverage exercises magic-link receipt and sign-in and email-template lifecycle. No dedicated automation workflow browser E2E spec was found in this pass.

Focused automation service and activity-handler tests cover every management action, precise draft differences, source context, repeated lifecycle requests, failed writes, event materialization, and simulation summaries without sample data. These unit tests verify transaction-handle propagation and error propagation; they do not prove rollback against a live database. No new authenticated browser or database E2E check was run.
