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
- Protect account-access links when the requested email address changes or a request becomes too old.
- Keep an enabled workflow's published template from being restored into a draft.

## End-User Value

Administrators can maintain timely, relevant communication without sending each message manually. Recipients get messages that reflect current account ownership and approved template content.

## How It Works

An administrator opens the Automations workspace, chooses an event, configures the email steps and recipients, then enables the workflow. Mentingo reacts to matching events, prepares recipient-specific content, and records the outcome for review.

Account-access emails use short-lived links. If a user's email changes before a queued message is prepared, Mentingo skips the old-address delivery; an already issued automation magic link also stops working after the change. A request that has aged past its lifetime does not gain a new lifetime merely because delivery was delayed.

Custom templates must remain published while an enabled workflow depends on them. Only archived templates can be restored into drafts, and a dependent enabled workflow blocks that restoration.

## Key Technical Context

- The workspace is at `/admin/automations`; its tabs are gated separately by `AUTOMATION_MANAGE`, `EMAIL_TEMPLATE_MANAGE`, and `AUTOMATION_LOG_READ`.
- The API separates workflow management, account-action token preparation, email delivery, and run history. Tenant-scoped database access and the email queue carry the work after an event.
- Magic-link requests retain the requested recipient on the account-action intent; delivery and redemption compare it with the current account email.
- Email-template lifecycle mutations use a shared lock and dependency check to protect enabled workflows.

## Test Evidence

Focused API service regressions cover old and changed email addresses, request-age expiry, and template restoration restrictions. A backend E2E regression covers rejecting an issued magic link after the account email changes; it has not been run against the shared development database.

Existing web E2E coverage exercises magic-link receipt and sign-in and email-template lifecycle. No dedicated automation workflow browser E2E spec was found in this pass.
