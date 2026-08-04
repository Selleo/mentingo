# #1846 Admin Announcement Recipient Visibility

## Summary

Prevent newly created content creators from seeing historical manual admin announcements that were not delivered to them.

The current announcement list treats every user with announcement-management permissions as a global manager. That causes the API to return every non-deleted manual announcement, regardless of the user’s recipient row or account creation time. The fix keeps the existing feed and UI structure, but narrows manual-announcement visibility by permission and ownership:

- Full announcement managers, currently represented by `ANNOUNCEMENT_DELETE`, can review all manual announcements.
- Content creators with announcement creation permission can see their own manual announcements and manual announcements delivered to them.
- Other users can see only published announcements delivered to them.
- System notifications remain recipient-based for every role.

## Product Decisions And Constraints

- Do not use account creation time as a visibility filter. Recipient rows are the source of truth for delivery.
- Do not add a second notification feed, new route, or new database table for this fix.
- Do not change announcement delivery, email delivery, scheduling, audience resolution, or Live Training notification behavior.
- Admins/full managers may continue to review historical manual announcements as a management capability.
- Content creators may review their own scheduled or published manual announcements even when they are not recipients; this is management visibility, not an unread personal notification.
- Content creators may see a manual announcement from another author only when a `user_announcements` row exists for them and the announcement is published.
- Author-only rows must not become unread notifications. They should retain `isRead: null` and must not affect the unread counter.
- Backend filtering is authoritative. Frontend visibility must not be used as the security boundary.
- Preserve tenant scoping and existing permission guards.
- Keep applied migrations and generated API artifacts unchanged.

## UI Direction

No new UI is required. The existing All, Admin announcements, and System tabs remain in place.

Expected behavior in the existing notification center:

- An admin/full manager continues to see all manual announcements in the Admin announcements tab.
- A content creator sees their own manual announcements and delivered manual announcements in the Admin announcements tab.
- A newly created content creator does not see older announcements authored by someone else unless explicitly delivered to them.
- System notifications remain limited to personal delivery rows.
- Own scheduled announcements may appear with the existing scheduled status, but they are not unread unless a recipient row exists.

The existing `NotificationAnnouncementItem` behavior should remain unchanged. In particular, the UI already treats only `isRead === false` as unread, so author-only management rows with `isRead: null` should not receive unread styling or mark-as-read controls.

## Routing And Frontend Structure

No route tree or generated client changes are expected.

Existing consumers remain unchanged:

- `apps/web/app/modules/Notifications/components/NotificationsPopover.tsx` continues to request the three feed variants.
- `apps/web/app/api/queries/admin/useAllAnnouncements.ts` and its infinite wrapper continue to call `GET /api/announcements`.
- The backend applies the new visibility rule consistently for the list response and pagination count.

If an existing frontend test asserts that a content creator sees all manual announcements, update that expectation to the author-or-recipient behavior. Do not add a client-side account-date filter or duplicate the permission logic in React.

## Backend And API Plan

### Current behavior

`AnnouncementsService.getAllAnnouncements` currently computes one `canManageAnnouncements` flag from `ANNOUNCEMENT_CREATE` or `ANNOUNCEMENT_DELETE`. `AnnouncementsRepository.getAllAnnouncements` then uses:

```ts
manual announcement OR personal published announcement
```

for every user with that flag. This is the effective backfill path.

Manual recipient rows are still created once by `AnnouncementsDeliveryService` through `createUserAnnouncementRecordsForAnnouncement`. The defect is that the manager list bypasses those rows for manual announcements.

### Visibility rule

Refine the service/repository contract so it distinguishes full management from author-level creation access:

```text
personalPublished = userAnnouncements exists AND announcement is published

if full manager:
  visible manual = every non-deleted manual announcement
else if announcement creator:
  visible manual = manual announcements authored by current user
                     OR published manual announcements with a recipient row
else:
  visible manual = published announcements with a recipient row

visible system = published system announcements with a recipient row
```

Use the existing permission model rather than hardcoded role names. `ANNOUNCEMENT_DELETE` is the current full-management capability; `ANNOUNCEMENT_CREATE` identifies users who may author announcements. Re-check the permission matrix while implementing in case custom permission combinations require the same distinction.

Apply the same condition to both the paginated data query and the `totalItems` count query. Keep feed filters after the visibility condition:

- `ADMIN_ANNOUNCEMENTS` keeps only manual source types.
- `SYSTEM` keeps only non-manual source types.
- `ALL` returns the union without exposing unrelated system notifications.

### API and data constraints

- No schema or migration change.
- No changes to `user_announcements` creation or uniqueness.
- No changes to announcement publication timing or recipient snapshotting.
- No changes to `getUnreadAnnouncementsCount`; author-only management rows must not create unread records.
- Existing soft deletion behavior remains unchanged and removes the shared announcement from every feed.

## Implementation Checklist

- [x] Confirm the full-manager permission used for “see all manual announcements”; use the shared permission constant rather than a role-name check.
- [x] Replace the single `canManageAnnouncements` visibility branch with full-manager versus author-level visibility inputs.
- [x] Add the author condition for manual announcements using the current user ID.
- [x] Preserve published-plus-recipient filtering for manual announcements not authored by the current user.
- [x] Preserve published-plus-recipient filtering for all system announcements.
- [x] Apply identical visibility conditions to the paginated select and `countDistinct` query.
- [x] Keep scheduled own announcements visible to their author if the existing management behavior supports scheduled rows.
- [x] Add/update the API E2E coverage described below.
- [x] Update the announcements business spec to say content creators review their own announcements and delivered announcements, while full managers can review all manual announcements.
- [x] Run the narrow API announcement test suite; relevant web notification tests were not needed because the API contract and frontend code are unchanged.

## Edge Cases

- **New content creator after publication:** no recipient row and not the author means the old manual announcement is absent.
- **Creator explicitly targeted:** recipient row plus published status makes the announcement visible, even if another user authored it.
- **Creator belongs to a selected group after publication:** they should not receive the old announcement unless a recipient row was created by an explicit delivery/re-delivery flow; group membership changes alone must not backfill it.
- **Creator’s scheduled announcement:** the author can see it for management; it is not unread without a recipient row.
- **Admin/full manager created after publication:** historical manual announcements remain visible by the agreed management rule.
- **System notification for a manager:** it remains visible only when the manager has a personal published recipient row.
- **Deleted announcement:** remains hidden for everyone through `deletedAt` filtering.
- **Custom permission combination:** a user with create permission but without full-management permission follows author-or-recipient visibility; a user granted the full-management permission follows the full-manager rule.
- **Read action on author-only row:** the UI should not expose mark-as-read because `isRead` is `null`; the API should not be changed to manufacture a read row.

## Tests And Validation

### API E2E

- [x] Full manager sees manual announcements authored by another user, including one with no personal recipient row.
- [x] Content creator sees their own manual announcement without a recipient row.
- [x] Content creator sees a published manual announcement when a recipient row exists.
- [x] Content creator does not see another creator’s manual announcement without a recipient row.
- [x] A content creator created after publication does not see the historical announcement.
- [ ] Content creator does not see another group’s announcement unless delivered to them.
- [ ] Scheduled own announcements retain the intended visibility and status.
- [x] System notifications remain limited to personal recipients for admins and creators.
- [ ] Pagination totals match the filtered data for full managers and creators.
- [ ] Unread count is unchanged for author-only management rows.

### Web validation

- [ ] Existing notification tabs still render without API contract changes.
- [ ] Admin/full manager can still review and delete manual announcements where permitted.
- [ ] Content creator does not see another creator’s historical announcement in All or Admin announcements.
- [ ] Author-only rows are not highlighted as unread and do not show the mark-as-read action.

### Commands

- `pnpm --filter=api test:e2e -- announcements.controller.e2e-spec.ts --runInBand` (passed: 29 tests).
- `pnpm --filter=api lint-tsc` (passed; Node 20 engine warnings only).
- Web notification tests were not run because the API contract and frontend code are unchanged.

## Non-Goals

- Building a separate announcement-management page.
- Changing the meaning of `user_announcements` or adding recipient backfill jobs.
- Filtering announcements by `users.createdAt`.
- Changing Live Training, course due-date, discussion, or email notification delivery.
- Removing historical migration files or changing notification preference settings.
