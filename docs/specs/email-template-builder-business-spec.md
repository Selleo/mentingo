# Email Template Builder — Business Spec

## Business Overview

The Email Template Builder lets organization administrators customize Mentingo's existing notification emails without writing HTML. Administrators can copy a read-only default email, adjust structured content and translations on the visual canvas, send a test with representative data, and publish it as the organization's override for a specific notification event.

The feature is intended for structured learning and account notifications rather than marketing campaigns. It helps HR and L&D teams keep learner communications on-brand, understandable, and multilingual while preserving Mentingo's existing recipients, triggers, and event data.

## Who Uses It

- Organization administrators customize the emails their organization sends to learners and administrators, such as course assignments, reminders, completions, certificate notices, invitations, and account-access messages.
- Platform/system administrators manage the built-in permission and maintain the code-defined default email catalog.

## Feature Functions

- Browse all current notification emails, including read-only default versions.
- Copy a default email into a tenant-owned template for a specific event.
- Duplicate an existing customized email as an independent draft, or start with the course-assignment example draft.
- Build emails visually by dragging headings, text, buttons, images, dividers, spacers, headers, and footers onto the canvas, or inserting them with a plus button.
- Use only the variables supported by the selected notification event.
- Maintain localized versions and fall back to the complete base language when a recipient translation is incomplete.
- Inspect unsaved emails in an inline desktop/mobile preview and send a test with sample event data.
- Save drafts, publish one active override per event, archive overrides, restore archived versions, and delete saved templates after confirmation.

## End-User Value

Administrators can improve the clarity and identity of operational emails without relying on developers. Learners receive more consistent, relevant, and localized guidance while the existing delivery rules and event-specific data remain intact.

## How It Works

Administrators open Email templates from the Manage navigation group. The paginated list shows organization-owned templates first, followed by Mentingo's read-only defaults with a System badge. Opening a system template lets an administrator inspect its content and variables, preview it, and copy it into an editable draft. An existing custom template can also be duplicated without changing the active email.

The editor presents a visual email canvas alongside a block palette and searchable event variables. Administrators drag new blocks to insertion points, move existing blocks with drag handles, or use plus buttons between blocks. Selecting text enables floating formatting controls; selecting buttons, images, or spacers exposes settings on the right. Compact controls duplicate, remove, or move blocks without dragging. Variables can be dragged into editable text and supported settings fields. Clicking a variable inserts at the selected text cursor, or creates a text block when no text block is selected. Valid event variables are highlighted in primary color only in the editor; this highlighting is not stored in email content. The editing canvas supports desktop and 375px mobile widths and displays tenant branding. Preview hides both side panels and block-editing controls so administrators can inspect the current canvas without distractions.

Administrators edit translated names, subjects, and bodies in all seven supported languages using the shared language selector beside the toolbar. Changing the base language requires saving first and selecting a complete translation; the API remains authoritative for validation. Saving sends only changed translations and preserves other stored locales, including changes made by another administrator. Simultaneous edits to the same locale still use the latest save. Leaving with unsaved changes prompts for confirmation. System templates remain read-only, including their palette and inline controls.

The Preview action toggles an inline view of unsaved content. It hides the block palette and variables panel on the left and the block settings panel on the right, and disables block editing. Toggling Preview off restores the panels and editing controls. Desktop/mobile controls remain available in preview. No dialog opens and no rendering request or save is made. Administrators send a test email to inspect sample-value rendering and delivery. Publishing asks for confirmation and saves current edits before activating the override. Saving an already published template updates the active email immediately. Archiving asks for confirmation; archived templates must be restored to a draft before editing again. Saved templates can also be deleted from the list or editor after confirmation. Deleted templates cannot be restored through the product. Deleting a published override returns future delivery to the system default. System defaults cannot be deleted. The editor requires saving or discarding unsaved changes before deletion.

The editor offers only the variables supplied by that event, with sample values for test email. The administrator can save incomplete work as a draft. Publishing requires a complete base-language subject and body plus valid block settings, links, images, and variables. Complete additional translations become active at the same time; incomplete translations use the base language for recipients.

Sending now resolves the published tenant override for the notification event. If none exists, Mentingo preserves the existing code-defined email and its conditional content. The existing event handlers still control recipients, notification settings, and trigger timing. Custom rendering uses actual event values and selects one complete translation for both subject and body, falling back directly to the template's base language.

Administrators can request a test of unsaved content with sample data, sent only to their own authenticated email address. The request validates content and language without rendering or downloading images. Rendering and sending run in a tenant-scoped background job; accepting the request means it was queued, not delivered. Requests are limited to five per minute through the existing rate-limit system, and jobs retry transient failures up to three attempts.

Images can be external HTTPS URLs or uploads. Uploaded images are private tenant-owned resources, stored as durable references and attached inline when sending, so delivered emails do not depend on expiring storage links. The canvas displays uploaded images through authorized temporary storage URLs. External images remain URLs and are not fetched by the backend. Uploads reuse existing file validation and storage, with a 5 MiB size limit and a 16-million-pixel decoding limit.

The visual canvas resolves saved uploaded-image references through a dedicated tenant-authorized image endpoint. It caches the signed storage URL and refreshes it while the editor remains open. Image editing retains URL, upload, alternative text, and width controls; the stored document still contains the durable asset reference, not the signed storage URL.

Each tenant receives one initial course-assignment example draft, including course and due-date variables. Startup provisions it for existing tenants; tenant creation provisions it for new tenants. Repeated provisioning does not overwrite changes or recreate a deleted example. Copying or duplicating a template always creates a draft and does not change the active override.

## Key Technical Context

- The permission is `EMAIL_TEMPLATE_MANAGE`, granted to the built-in administrator role by default.
- Code-defined event defaults, translated display names, and variable metadata live in `packages/email-templates`; tenant overrides are stored as tenant-scoped API/database records in `email_templates` with database-enforced row-level isolation.
- The editor contract uses a controlled set of email blocks with Tiptap-compatible JSON for rich content.
- The API exposes default and override resources, copy/duplicate/save/publish/archive/restore/delete operations, base-language changes, preview, image uploads, and queued test sends under `EMAIL_TEMPLATE_MANAGE`.
- Strict API schemas validate the versioned block document. A dedicated validator enforces event variables, mandatory authentication links, meaningful base-language content, and safe HTTPS links/images.
- Test emails and the backend preview endpoint use the shared React Email renderer with tenant branding and representative event values. The inline editor preview displays the current canvas and variable tokens.
- Backend sample rendering resolves one complete language for the whole email and includes the tenant logo and company name. Overdue-course samples preserve all collection entries, and footer blocks support rich text.
- API responses expose supported variables and sample values. Authentication emails require a usable action link in every complete translation, and errors/warnings have translations in all supported UI languages.
- Publication replaces the active tenant/event override transactionally. Template lists query tenant overrides by page and append read-only code defaults only after the final override.
- Runtime resolution is integrated across all 22 registered email events, including password-email batches and live-training notifications. Previously queued password-email payloads without template context retain their original rendering.
- The frontend lives at `/admin/email-templates`, with default-event and custom-template editor routes. It uses existing admin page, table, dialog, and input conventions and the generated API client. Navigation and routes require `EMAIL_TEMPLATE_MANAGE`.
- Activity logging remains unimplemented. Existing email triggers and recipients are unchanged; deployment should still include database/API and delivery smoke tests before production rollout.

## Test Evidence

The current focused backend verification passed 101 tests across 11 suites. Coverage includes runtime override selection, whole-email language fallback, authentication URL validation, recipient/sender/attachment preservation, private asset ownership and direct image URL lookup, validation-only test enqueueing, and variables split across rich-text formatting boundaries.

A PostgreSQL integration regression additionally verifies concurrent edits to separate languages for names, subjects, and document bodies. It checks preservation of untouched translations and clearing one draft subject without deleting other locales. The test uses the tenant-aware database connection and real SQL updates, including existing JSON-encoded translation maps.

Frontend verification passed 42 tests across seven suites. The preview tests verify that both side panels and block-editing controls hide and restore on toggle, desktop/mobile switching remains available, and read-only templates stay read-only. The editor verifies that preview preserves unsaved input without opening a dialog, saving, or requesting backend rendering. Saving sends only edited locales and accepts the server's merged translations. Image tests verify direct authorized asset lookup without constructing an email. Existing block, rich-text, language-completeness, and list behavior tests also pass. API and web typechecks and scoped ESLint checks pass; the email-template package builds successfully.

Full authenticated browser E2E, real storage, SMTP delivery, worker retries, and controller authorization end to end were not exercised in this remediation run. Earlier local browser smoke testing reached the tenant login page but could not authenticate with the repository test administrator credentials.

Visual-editor regression coverage includes palette insertion, insertion at a selected plus button, immutable movement to drop positions, read-only controls, image-upload delegation, and desktop/mobile switching. An isolated browser fixture additionally verified pointer dragging from the palette, existing-block reordering, inline typing, insertion of a variable at the text cursor, variable search, and the 375px canvas width. These checks did not mutate tenant templates or verify authenticated image storage and delivery.

### Deletion and input-validation updates

The frontend blocks saving, publishing, and test sending when a button has no label or URL, or an image has no source. It switches to the affected language and displays block errors so administrators can fix the content before making a request.

Deletion uses the existing management permission and tenant isolation. A deletion marker keeps removed templates out of reads, lists, editing, restoration, and published-template selection, and prevents startup from recreating a deleted example. Shared uploaded assets remain available to other templates.

Deletion regression coverage passes three PostgreSQL E2E tests for removal from delivery and reads, tenant isolation, and example provisioning. Frontend tests cover confirmation, cancellation, deletion failures, and blocking incomplete button fields before save requests.

### Email outline and divider sizing

The editor's table of contents lists every block in email order. Selecting an entry scrolls to and selects the corresponding block, making thin dividers easy to reach. The selected block's settings appear in the settings panel. The outline follows insertions, deletions, and reordering, and is hidden together with the side panels during preview.

Divider height controls line thickness from 1 to 200 pixels in both the editing canvas and rendered emails. Existing dividers without a height keep a 1-pixel line. Height is saved with each language's document. System defaults remain read-only.
