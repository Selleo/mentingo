# Email Template Builder — Business Spec

## Business Overview

The Email Template Builder backend lets organization administrators customize Mentingo's existing notification emails without writing HTML. Its API supports copying a read-only default email, adjusting structured content and translations, previewing it with representative data, and publishing it as the tenant's override for a specific notification event. The visual editor remains to be implemented.

The feature is intended for structured learning and account notifications rather than marketing campaigns. It helps HR and L&D teams keep learner communications on-brand, understandable, and multilingual while preserving Mentingo's existing recipients, triggers, and event data.

## Who Uses It

- Organization administrators customize the emails their organization sends to learners and administrators, such as course assignments, reminders, completions, certificate notices, invitations, and account-access messages.
- Platform/system administrators manage the built-in permission and maintain the code-defined default email catalog.

## Feature Functions

- Browse all current notification emails, including read-only default versions.
- Copy a default email into a tenant-owned template for a specific event.
- Duplicate an existing customized email as an independent draft, or start with the course-assignment example draft.
- Define structured content with headings, text, buttons, images, dividers, spacers, headers, and footers.
- Use only the variables supported by the selected notification event.
- Maintain localized versions and fall back to the complete base language when a recipient translation is incomplete.
- Preview and test the current email content with sample event data.
- Save drafts, publish one active override per event, archive overrides, and restore archived versions.

## End-User Value

Administrators can improve the clarity and identity of operational emails without relying on developers. Learners receive more consistent, relevant, and localized guidance while the existing delivery rules and event-specific data remain intact.

## How It Works

The planned editor will let an administrator browse tenant-owned templates first, followed by Mentingo's read-only defaults. The backend already supports that ordering, copying a default for an event, editing content, choosing a base language, and adding other supported translations.

The editor offers only the variables supplied by that event, with sample values for preview and test email. The administrator can save incomplete work as a draft. Publishing requires a complete base-language subject and body plus valid block settings, links, images, and variables. Complete additional translations become active at the same time; incomplete translations use the base language for recipients.

Sending now resolves the published tenant override for the notification event. If none exists, Mentingo preserves the existing code-defined email and its conditional content. The existing event handlers still control recipients, notification settings, and trigger timing. Custom rendering uses actual event values and selects one complete translation for both subject and body, falling back directly to the template's base language.

Administrators can request a test of unsaved content with sample data, sent only to their own authenticated email address. Sending runs in a tenant-scoped background job; accepting the request means it was queued, not delivered. Requests are limited to five per minute through the existing rate-limit system, and jobs retry transient failures up to three attempts.

Images can be external HTTPS URLs or uploads. Uploaded images are private tenant-owned resources, stored as durable references and attached inline when sending, so delivered emails do not depend on expiring storage links. Preview embeds uploaded images directly. External images remain URLs and are not fetched by the backend. Uploads reuse existing file validation and storage, with a 5 MiB size limit and a 16-million-pixel decoding limit.

Each tenant receives one initial course-assignment example draft, including course and due-date variables. Startup provisions it for existing tenants; tenant creation provisions it for new tenants. Repeated provisioning does not overwrite changes or recreate an archived/published example. Copying or duplicating a template always creates a draft and does not change the active override.

## Key Technical Context

- The permission is `EMAIL_TEMPLATE_MANAGE`, granted to the built-in administrator role by default.
- Code-defined event defaults, translated display names, and variable metadata live in `packages/email-templates`; tenant overrides are stored as tenant-scoped API/database records in `email_templates` with database-enforced row-level isolation.
- The editor contract uses a controlled set of email blocks with Tiptap-compatible JSON for rich content.
- The API exposes default and override resources, copy/duplicate/save/publish/archive/restore operations, base-language changes, preview, image uploads, and queued test sends under `EMAIL_TEMPLATE_MANAGE`.
- Strict API schemas validate the versioned block document. A dedicated validator enforces event variables, mandatory authentication links, meaningful base-language content, and safe HTTPS links/images.
- Preview uses the shared React Email renderer with tenant branding and representative event values. The renderer produces the subject, HTML, and plain text from the same structured document.
- Preview resolves one complete language for the whole email and includes the tenant logo and company name. Overdue-course previews preserve all collection entries, and footer blocks support rich text.
- API responses expose supported variables and sample values. Authentication emails require a usable action link in every complete translation, and errors/warnings have translations in all supported UI languages.
- Publication replaces the active tenant/event override transactionally. Template lists query tenant overrides by page and append read-only code defaults only after the final override.
- Runtime resolution is integrated across all 22 registered email events, including password-email batches and live-training notifications. Previously queued password-email payloads without template context retain their original rendering.
- Activity logging and the visual editor remain unimplemented. Existing email triggers and recipients are unchanged; deployment should still include database/API and delivery smoke tests before production rollout.

## Test Evidence

The focused verification run passed 61 tests across 11 suites, including existing notification and password-email activity-handler regressions. New unit tests cover runtime override selection, whole-email language fallback, actual authentication URL validation, recipient/sender/attachment preservation, asset ownership checks, CID and preview image rendering, administrator-only queued test sends, duplication, and stable tenant example identities. Rate-limit policy tests cover test-send throttling.

These tests use mocked database, storage, queue, and mail-adapter boundaries. They do not prove PostgreSQL RLS/concurrency, actual SMTP delivery, live storage behavior, worker retries, or controller permission enforcement end to end. Those integration checks and builder UI E2E coverage remain outstanding.
