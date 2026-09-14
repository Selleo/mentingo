# Email Template Builder — Implementation Order

Status: backend implementation in progress

2026-09-14 update: runtime delivery resolution, queued administrator-only test sends, uploaded-image ownership and inline delivery, tenant-template duplication, and example-draft provisioning are implemented. The new API contracts have been regenerated. Activity logging, the web editor, and full database/API E2E verification remain. See the [business spec](./email-template-builder-business-spec.md) for current behavior and test evidence.

Design decisions: [email-template-builder-decisions.md](./email-template-builder-decisions.md)

The order below follows the runtime and repository dependencies. The API contract should be established before frontend callers are built, and the existing email event/recipient flows should remain responsible for delivery semantics.

## 1. Freeze the domain contract

Define the stable concepts before writing UI or persistence code:

- Notification event identifiers for every current email template.
- Template sources: code-defined default versus tenant override.
- Template statuses: draft, published, archived.
- Base language and translation completeness rules.
- Allowed variables and sample preview values per event.
- Block types and their typed attributes.
- Validation errors versus non-blocking warnings.
- Permission name: `EMAIL_TEMPLATE_MANAGE`.

Output: shared TypeScript/domain types and a written event/block contract.

## 2. Add the shared permission

Add `EMAIL_TEMPLATE_MANAGE` to `packages/shared` and grant it to the built-in organization administrator/system administrator role by default.

Use the shared permission in both API authorization and web route/navigation access. Do not rely on frontend access checks for security.

Validation:

- Permission constants and default role mappings compile.
- Unauthorized API requests are rejected.
- Authorized administrators can see the future route entry.

## 3. Build the code-defined email registry

Create the authoritative registry in `packages/email-templates`.

Each event definition should include:

- Event identifier and display metadata.
- Default localized template/block document.
- Allowed variables and sample values.
- Required fields and block validation rules.
- Initial base language, defaulting to English.

Keep the existing React Email templates available while the new renderer is introduced. Convert defaults incrementally, with output comparisons against the current templates.

Validation:

- Every current email trigger has exactly one registry entry.
- Every registry variable exists in the event/context data.
- Default documents render in every supported language.
- Existing default email snapshot/E2E expectations remain valid.

## 4. Define the persisted override model

Add tenant-scoped persistence for editable overrides and their language versions.

The model should support:

- Event identifier.
- Localized name.
- Status and archive metadata.
- Base language.
- Localized subject and block document.
- Created/updated/published/archived metadata.
- Multiple drafts and archived records per event.
- At most one published override per tenant and event.

Keep code-defined defaults out of the database.

Use Drizzle schema changes and generated migrations. Do not hand-edit migration files.

Validation:

- Tenant isolation is covered by repository tests.
- Database constraints or transactional logic enforce one published override per tenant/event.
- Archived records can be restored by publishing them again.

## 5. Implement domain validation and rendering

Create backend services that:

- Validate Tiptap/block JSON against the event registry.
- Extract and validate variables.
- Validate links and image sources.
- Calculate translation completeness.
- Resolve recipient language to the complete translation or base language.
- Render subject, HTML, and plain text.
- Apply tenant branding and safe defaults.

Use a controlled renderer based on the existing React Email package. Keep raw HTML outside the supported document model.

Validation:

- Base-language completeness blocks publication.
- Incomplete non-base translations produce warnings and fall back to base.
- Unknown variables and invalid block fields are rejected.
- HTML and plain-text output render correctly for all block types.

## 6. Add the backend API

Implement tenant-scoped endpoints for:

- Paginated template list combining editable tenant records first and code-defined defaults last.
- Template details.
- Copy default to tenant draft.
- Create, save, publish, archive, and restore override.
- Change base language when the new base translation is complete.
- Preview current editor content with sample values.
- Send a test email to the current administrator.
- Return validation errors, warnings, supported variables, and translation status.

Keep controllers thin, use TypeBox schemas, enforce `EMAIL_TEMPLATE_MANAGE`, and preserve tenant RLS boundaries.

Validation:

- API E2E tests cover permissions, tenant isolation, pagination, lifecycle transitions, language fallback, validation, preview, and test email delivery.
- The published override is selected by event at runtime; otherwise the code default is selected.

## 7. Integrate runtime email delivery

Update existing notification handlers to resolve the event's published tenant override before rendering. Preserve existing recipient selection, event payloads, attachments, and email adapter behavior.

The integration should follow this path:

```text
existing event/handler → template resolver → override or code default → renderer → existing EmailService/adapter
```

For security-sensitive templates, verify required action URLs and event variables before sending.

Validation:

- Existing email trigger E2E tests pass using code defaults.
- A published override changes only the intended event.
- Archiving an override immediately restores the code default.
- Authentication links remain correct and usable.

## 8. Regenerate the web API client

After the API schemas and Swagger contract are complete, run the existing web client generation command. Do not edit `apps/web/app/api/generated-api.ts` by hand.

Then add query and mutation hooks through `ApiClient.api...`, following existing invalidation and error-toast conventions.

## 9. Build the Email Templates list experience

Add the protected Manage route and navigation entry.

The list should provide:

- Tenant-owned templates first.
- Code-defined defaults at the end of pagination.
- Default, draft, published, and archived status indicators.
- Event type, language completeness, updated time, and ownership/source.
- Copy, edit, archive, restore, and duplicate actions where applicable.
- The example draft connected to `User assigned to course`.

Defaults must be visibly read-only and must not expose edit/archive actions.

## 10. Build the editor shell and block interactions

Implement the editor using existing Mentingo UI primitives and Tiptap.

Support:

- Localized template name.
- Event association.
- Base language and language tabs.
- Subject.
- Ordered blocks.
- Add, insert-after, select, move up/down, duplicate, and delete.
- Selected-block settings.
- Variable insertion from the event registry.
- Inline editing for supported rich text.
- Validation errors and warnings.

Use the controlled block schema rather than allowing arbitrary Tiptap top-level structures.

## 11. Build preview and test-email flows

Add a preview that renders the current editor state with:

- Selected language.
- Sample event values.
- Tenant branding.
- Subject.
- Responsive email output.

Test email should use the current valid editor state, including unsaved changes, and send only to the current administrator.

## 12. Add activity logging

Record create, copy, save, publish, archive, restore, and test-email actions through the existing activity-log system.

Log actor, event/template identifier, action/status transition, and timestamp. Do not log full template content or variable values.

## 13. Add focused tests and regression coverage

Backend:

- Registry completeness and variable compatibility.
- Renderer output for each block and supported language.
- Validation and warning behavior.
- Repository tenant isolation and lifecycle rules.
- Event resolution and fallback behavior.
- Test-email delivery.
- Activity logging.

Frontend:

- Route/permission visibility.
- Default versus override list behavior and pagination.
- Block operations.
- Variable insertion.
- Language completeness/base-language changes.
- Validation and warning presentation.
- Preview/test-email actions.

E2E:

- Administrator copies a default, edits it, previews it, saves it, publishes it, and observes the override being used by the corresponding event.
- An incomplete recipient translation falls back to the base language.
- Archiving the override restores the code default.
- Non-administrators cannot access or mutate templates.

## 14. Roll out safely

Release in this order:

1. Ship the registry and renderer behind the existing default behavior.
2. Ship persistence and read-only list support.
3. Ship copying, editing, preview, and test email.
4. Ship publishing and runtime override resolution behind a feature flag if needed.
5. Enable the feature for internal tenants first.
6. Compare rendered defaults against current email output before broad enablement.

Do not require a data migration for code-defined defaults. Existing tenants continue using current defaults until a tenant publishes an override.

## Definition of done

- Every existing email event has a code-defined default registry entry.
- The builder supports tenant overrides without changing recipient/event ownership.
- Defaults are read-only and remain available when no override is published.
- Published overrides render safely in HTML and plain text.
- Base-language and variable validation prevent broken sends.
- Preview, test email, language fallback, permissions, tenant isolation, and activity logs are covered by tests.
- Generated API artifacts are regenerated through the existing command.
