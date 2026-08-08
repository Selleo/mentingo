# Email Notification Templates Business Spec

## Business Overview

Email notification templates let HR and L&D teams control the messages Mentingo sends around learning workflows without relying on engineering for every wording or layout update. Administrators can create reusable email templates, edit subject lines and body content, manage translations, send themselves a test email, and decide whether a template is draft, published, or archived.

The feature matters because learning communication is part of the learner experience. Clear, branded, localized email content helps learners recognize required actions, understand training context, and trust that a message belongs to their organization.

The main workflow starts from the admin email templates list. A manager creates or opens a template, edits the subject and email body in a visual builder, chooses available languages, reviews inline diagnostics next to the exact content that needs attention, and publishes only when blocking errors are resolved.

## Who Uses It

- HR and L&D administrators maintain organization-specific learning emails so learners receive clear and branded communication.
- Training operations managers duplicate existing templates when a new campaign or language variant needs similar structure with different wording.
- Platform administrators review template status, archive obsolete templates, and send test emails before learner-facing delivery changes go live.

## Feature Functions

- Create and edit email templates with a subject line and visual body blocks; new templates start from a centered branded logo, heading 2, paragraph, call-to-action button, divider, and footer structure, with starter placeholder text populated in the selected base language.
- Manage multilingual versions by selecting available locales, setting the base language, and editing translated content in the same builder.
- Show diagnostics inline beside affected builder nodes so missing text, missing button targets, invalid URLs, and untranslated content are easier to fix in context.
- Keep orphan diagnostics, such as missing template name, missing footer, or missing logo branding, at the bottom of the builder when they do not belong to a specific content block.
- Send test emails in an available language with tenant colors and the tenant logo, or Mentingo branding when no tenant logo is configured, resolved into the rendered message before publishing.
- Duplicate templates with fresh internal block identifiers so copied templates can be edited independently.
- Move templates through draft, published, archived, and restored draft states.
- Delete one or several templates from the admin list when they are no longer needed.
- Restrict the feature to users with email template management access.

## End-User Value

Email templates improve operational consistency by letting non-engineering administrators update learner communication quickly. Inline diagnostics reduce publishing friction because editors can see what is wrong where they are working, instead of interpreting a detached checklist. Multilingual editing supports organizations that deliver training across language groups, and test sends help teams verify the learner-facing result before publication.

## How It Works

An administrator opens the email templates area, filters or selects a template, and edits it in a builder with a subject card and email body canvas. New templates start with a simple centered branded layout: organization logo, secondary heading, paragraph text, call-to-action button, divider, and footer, and the starter text follows the base language chosen at creation. The builder keeps structural content in the base template and stores translated fragments by language, so the editor can switch languages while preserving the same email layout.

Mentingo calculates diagnostics from the template name, available languages, subject, body blocks, button configuration, URLs, footer, logo branding, and translation content. Warnings are shown in yellow and do not block publishing. Errors are shown in red and continue to block save/publish flows for published templates or publish attempts. Diagnostics attached to a known block appear next to that block; diagnostics without a live block target appear below the template body with visual spacing.

Draft and published templates can keep a button without a target URL when an administrator wants the button as a visual placeholder or intends to finish the destination later. Mentingo shows the missing button URL as a nonblocking warning note, while the backend URL safety layer still rejects dangerous URL schemes such as script-based links.

When an administrator adds a new content block in a translated version, Mentingo waits until the editor leaves that new block before showing its missing-translation warning. Other diagnostics still appear immediately, and untouched new blocks or programmatic changes do not keep warnings hidden after focus is resolved.

When templates are rendered for backend preview or test-send flows, Mentingo uses the selected available language with tenant branding such as the primary color and logo. If the tenant has not configured a logo, the builder and rendered output use the Mentingo logo instead of exposing the internal logo placeholder. Preview HTML uses a browser-readable logo URL, while sent test emails embed the logo as an inline email image so mailbox clients can display it inside the message body. The backend rejects unsupported or duplicate language configuration, rejects unavailable preview/test languages, checks template name uniqueness, prunes translations for deleted blocks, and queues unused uploaded email images for cleanup after updates or deletes.

## Key Technical Context

- The admin routes are `admin/email-templates` and `admin/email-templates/:id`, gated in route access by `PERMISSIONS.EMAIL_TEMPLATE_MANAGE`.
- The main frontend module is `apps/web/app/modules/Admin/EmailTemplates`, including the list page, edit page, Maily-based builder, language selector, diagnostics, and image upload handling.
- The main API module is `apps/api/src/email-notification-templates`, with endpoints for list, create, update, publish, make draft, archive, unarchive, delete, duplicate, preview, and test-send.
- Shared language, diagnostic, and branding contracts live in `@repo/shared`, including supported languages, email template node types, `computeEmailTemplateDiagnostics`, and the tenant-logo variable/CID constants.
- Backend template creation seeds the default body blocks with localized placeholder text based on the selected base language when no custom blocks are supplied.
- A BullMQ cleanup worker purges uploaded email-template images only after confirming they are no longer referenced by another template.
- Inline diagnostics are a frontend safety layer; backend validation still protects language configuration, URL safety, preview/test language availability, logo-variable rendering, and template persistence.

## Test Evidence

Backend unit tests cover locale validation, unique template names, auto-generated names, duplicate naming and block re-keying, preview and test-send language behavior, tenant color and logo rendering, inline email logo attachments, translation pruning, queued image cleanup, deletion, and status transitions. Focused URL-safety coverage verifies that freshly created default draft blocks can be saved with an empty starter button URL, publishing is not blocked by that warning, and unsafe protocols are still rejected.

Frontend unit tests cover the email builder upload handler, translation-mode wiring, inline diagnostic rendering and placement safeguards, delayed missing-translation warnings for newly added blocks, inline note severity styling, language tag visibility, and diagnostic reason rendering. Playwright E2E coverage verifies that an admin can create a template, rename it, edit and save the subject, reload the edit page, see the template in the list, and delete it.
