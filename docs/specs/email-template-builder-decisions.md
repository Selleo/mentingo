# Email Template Builder — Design Decisions

Status: discovery in progress

Source: [GitHub issue #1719](https://github.com/Selleo/mentingo/issues/1719)

This document records decisions made during design discovery. It is not yet a complete implementation specification.

## Resolved decisions

### 1. Template scope

Templates are attached to existing notification triggers. V1 does not support arbitrary marketing campaigns or independent automations.

Runtime model:

```text
notification event → published template → selected language → rendered email
```

### 2. Template ownership

Templates are tenant-scoped. Organization admins can create, edit, publish, duplicate, and archive templates only for their organization.

Current Mentingo email templates are code-defined defaults, not database records. They are visible in the tenant's paginated email-template list with a `Default` badge, are read-only, and appear at the end of the list.

Admins can copy a default email into a tenant-owned draft and customize that copy. Tenant-owned templates are the only editable/publishable records. There is also one example draft tied to the `User assigned to course` notification event so it can demonstrate course name, course link, and optional due-date variables. The example remains a draft and does not affect sending until explicitly published as the event's override.

For each event, a published tenant-owned override takes precedence over the code-defined default. If no published override exists, the event continues using the default email.

Multiple tenant drafts and archived versions may exist for one event, but only one tenant override can be published at a time. Publishing a new override replaces the previous published override. Archiving the active override makes the event fall back to its code-defined default.

Archived overrides remain available in tenant history and can be restored by publishing them again after validation.

Published tenant overrides are edited directly. Editing an active override does not create a separate draft revision. Changes become active only after an explicit `Save`; the complete template is validated and replaced atomically. V1 does not autosave.

### 3. Language fallback

The template's base language is authoritative and must be complete before publishing.

Admins may change the base language at any time, including after publishing, but only to a language version that is fully complete.

If the recipient's language is missing or incomplete, the email falls back directly to the base language. A separate fallback-language setting is not needed for V1.

Only languages from Mentingo's supported-language list are allowed.

### 4. Default and override behavior

Defaults and overrides are separate concepts:

- Defaults are maintained in code and cannot be edited, published, or archived by tenants.
- Overrides are tenant-scoped database records created by copying a default.
- An event uses the published tenant override when one exists; otherwise it uses the code-defined default.
- The list UI must keep default entries at the end of pagination and label them clearly.
- The example draft is connected to one real event and uses that event's supported variables.
- Multiple drafts and archived versions are allowed per event, with at most one published override.
- Archived overrides can be restored by publishing them again after validation.
- Published tenant overrides can be edited directly without creating a separate draft revision.
- Changes to published overrides become active only after explicit `Save` and atomic validation; V1 does not autosave.

### 5. Included notification types

V1 includes all current email templates, including authentication and onboarding emails.

Authentication templates require stricter validation for required security links and other mandatory fields.

### 6. Variables

Each notification type has an allowed variable registry derived from the data supplied in its existing event/context.

Admins may use only variables supported by that notification type. The editor should make supported variables easy to insert, and publishing should reject unknown variables or invalid syntax.

Variable values are supplied automatically at runtime; admins do not manually map variables.

### 7. Persisted content model

Persist a versioned structured document rather than generated HTML.

The document uses Tiptap JSON for editable rich-text content, combined with a controlled list of custom top-level email blocks:

- `header`
- `heading`
- `text`
- `button`
- `image`
- `divider`
- `spacer`
- `footer`

Rich content inside suitable blocks—especially `text`, `heading`, and `footer`—uses Tiptap JSON. Button URLs, image metadata, spacing, and branding settings remain typed block attributes.

The backend validates the document and renders the final HTML and plain text through a controlled email renderer. Arbitrary raw HTML is not part of the V1 editing model.

### 8. Rich-text formatting

V1 supports only a restricted formatting set inside text-capable blocks:

- bold
- italic
- links
- paragraph breaks

V1 does not support tables, lists, arbitrary colors, arbitrary font sizes, embedded media, or raw HTML.

## Existing-system constraints

- Email rendering currently happens server-side through the `packages/email-templates` package and React Email.
- Existing notification handlers determine recipients, event data, and tenant branding; the builder should replace the content/rendering layer without changing those responsibilities.
- Tenant branding should reuse the existing company name, primary color, and logo/default behavior.
- The generated HTML and plain text must remain compatible with the existing email adapters.
- Access is controlled by a dedicated shared `EMAIL_TEMPLATE_MANAGE` permission. It gates the Email Templates navigation, page access, and all tenant template mutations; API authorization remains authoritative.
- The built-in organization administrator/system administrator role receives `EMAIL_TEMPLATE_MANAGE` by default. Other roles require explicit custom-role configuration.
- Image blocks support either uploaded tenant-owned assets through the existing file-storage flow or externally hosted image URLs. Both sources must pass the platform's normal validation and rendering rules.
- External image sources are restricted to `https://` URLs that pass image-URL validation; local/private-network targets are rejected. Uploaded files use the existing image MIME/type validation.
- Test emails render the current editor contents, including unsaved changes, with sample values for the selected event and language. They require structural and variable validation but not publishing, and are sent only to the current admin's own email address.
- Tenant templates and code-defined defaults are exposed as one logical normalized list. Editable tenant templates appear first, defaults appear afterward, and pagination is applied after this ordering so defaults occupy the final page(s).
- `packages/email-templates` is the authoritative registry for code-defined defaults and event variables. Each registry entry contains the event identifier, display metadata, default localized block document, required fields, and allowed variables/sample values. The API exposes this registry to the web editor, and the same definitions drive default rendering and runtime validation.
- Maily is reference material only. The editor uses the repository's existing Tiptap setup, Mentingo UI primitives, and custom email block extensions/rendering. Maily is not added as a runtime dependency, and its implementation is not copied wholesale.
- Drafts use explicit `Save draft` and `Publish` actions. `Save draft` stores incomplete or unpublished changes. `Publish` validates the complete base-language template and activates the override for its event. Once published, `Save` validates and applies edits directly. `Test email` is available for any valid editor state, including unpublished drafts.
- Publication is blocked by a missing template name/event, incomplete base-language subject or body, missing required block fields, invalid or unsupported variables, invalid links, invalid image sources, or malformed Tiptap/block JSON. Missing footer content and incomplete non-base translations are warnings only. V1 does not store a separate preheader field.
- New tenant overrides start with English as the base language. All available code-defined translations are copied into the override, but English must be complete before the override can be published. The base language can later be changed to any fully complete translation.
- Header and footer are ordinary editable blocks, not mandatory system-managed blocks. New templates start with a branded header and footer, but admins may move, duplicate, edit, or delete them. Removing either produces a warning rather than blocking publication.
- Template actions are audited through the existing activity-log system: create, copy, save, publish, archive, restore, and test-email actions record the actor, event/template identifier, status transition, and timestamp. Full email content and variable values are not logged.
- Publishing activates the entire multilingual template atomically. The base language must be complete; complete additional translations become active immediately, while incomplete translations remain stored and fall back to the base language.

## Open questions

The following decisions remain unresolved:

- Exact block settings and validation rules for each block type.
- Exact permissions and navigation placement under Manage.
