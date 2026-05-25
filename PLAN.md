# Multi-Language Announcements And Notification Popup Plan

## Summary

- [ ] Replace dedicated announcement pages with a navigation-triggered notification popup.
- [ ] Keep announcements as the durable notification source for now, with two popup tabs: `All` and `Admin announcements`.
- [ ] Create announcements from an admin dialog using one multi-language payload.
- [ ] Add mark-all-read and soft delete support.

## Backend

- [ ] Convert `announcements.title` and `announcements.content` to localized JSONB fields using the same staged migration convention as groups.
- [ ] Add translation columns plus `base_language` and `available_locales`.
- [ ] Backfill existing announcement title/content into English translations.
- [ ] Drop old plain text columns and rename translation columns.
- [ ] Add `deleted_at` for soft delete.
- [ ] Filter deleted announcements out of all list, count, read, and user queries.
- [ ] Change create payload to include `groupId`, `baseLanguage`, and `translations`.
- [ ] Validate create payload server-side:
  - [ ] At least one translation.
  - [ ] Base language is included.
  - [ ] No duplicate languages.
  - [ ] Title/content are non-empty.
  - [ ] Title max length is 120.
- [ ] Add `PATCH /api/announcements/read-all` for the current user.
- [ ] Add `DELETE /api/announcements/:id` for soft delete.
- [ ] Add `ANNOUNCEMENT_DELETE`, grant it to admin by default, and guard delete with it.
- [ ] Keep create guarded by `ANNOUNCEMENT_CREATE`.

## Frontend

- [ ] Remove `/announcements` and `/admin/announcements/new` routes/pages.
- [ ] Remove related route access entries.
- [ ] Replace the footer announcement navigation link with a notification popup trigger labelled `Notifications`.
- [ ] Build popup header with title, refresh button, and plus button for users with `ANNOUNCEMENT_CREATE`.
- [ ] Add popup tabs: `All` and `Admin announcements`.
- [ ] Show announcements in both tabs for this pass.
- [ ] Support read/unread state in popup items.
- [ ] Add per-item mark-as-read.
- [ ] Add mark-all-read footer action.
- [ ] Add delete action for users with `ANNOUNCEMENT_DELETE`.
- [ ] Open a create-announcement dialog from the plus button.
- [ ] Add group selector to the dialog.
- [ ] Add one language selector controlling the active translation.
- [ ] Support frontend-only add language, remove language, and set-base-language actions before submit.
- [ ] Store form state as translations by language.
- [ ] Submit all translations in one payload.
- [ ] On validation failure, switch the active language to the first failing translation.
- [ ] Regenerate the web API client after Swagger changes.
- [ ] Update global search announcement links so they no longer point to removed pages.
- [ ] Prefer opening the notification popup from global search if existing navigation state supports it cleanly.

## Tests

- [ ] API e2e: create multi-language announcement and verify localized reads by `language`.
- [ ] API e2e: reject missing base language.
- [ ] API e2e: reject duplicate languages.
- [ ] API e2e: reject empty title/content.
- [ ] API e2e: reject overlong titles.
- [ ] API e2e: mark one announcement read.
- [ ] API e2e: mark all announcements read.
- [ ] API e2e: soft delete hides announcement from user/admin queries and unread counts.
- [ ] API e2e: group-scoped announcement visibility still works.
- [ ] Web tests: mutation hooks invalidate announcement popup/list/count queries.
- [ ] Web tests: creation dialog can add/remove languages, set base language, and switch to failing language on validation.
- [ ] Web tests: popup refresh, mark-all-read, per-item read, and admin delete actions work.

## Validation

- [ ] Run focused API announcement e2e tests.
- [ ] Run web lint/typecheck or focused tests for notification/announcement modules.
- [ ] Run `pnpm generate:client` after API contract changes.

## Assumptions

- [ ] `Admin announcements` is the user-facing tab name for human-created announcements.
- [ ] The plus button follows `ANNOUNCEMENT_CREATE`; delete follows new `ANNOUNCEMENT_DELETE`.
- [ ] Soft delete is enough for user-visible deletion; activity log history can keep existing create/read records.
- [ ] No generic notifications table is introduced in this pass.
