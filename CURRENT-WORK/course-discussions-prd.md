# Course Discussions PRD

## Problem Statement

Students enrolled in a Mentingo course currently have no way to talk to each
other or to the course author within the course itself. Conversation happens
out-of-band (email, Slack, nowhere), so questions go unanswered, peer learning
is lost, and prospective students see no signal that the course has an active
community. Course authors and admins also lack a lightweight place to gather
feedback or post course-wide announcements scoped to a specific course.

At the same time, prospective students browsing a course page have no social
proof that other learners actually finish the course. The page lists chapters
and an author, but nothing that says "people like you complete this."

## Solution

Add a course-level **Discussion** tab to the course page that any enrolled
student, the course author, and admins can read and post in. Comments are flat
top-level threads with one level of replies, plain text, like-able, edit/delete
by author, and moderate-able by course author or admin. The tab can be globally
disabled by an admin via Platform Customization (mirroring the existing
Q&A / News / Articles toggles).

Independently, the course hero gains a small **"Completed:"** social-proof
element showing the avatars of the three most recent students who completed the
course, plus a `+X` overflow when more than three have finished. This is
visible to everyone, not gated on enrollment, and not gated on the discussions
toggle.

## User Stories

1. As an enrolled student, I want to see a Discussion tab on the course page,
   so that I can talk to other learners taking the same course.
2. As an enrolled student, I want to post a top-level comment on a course, so
   that I can ask a question or share a thought with the cohort.
3. As an enrolled student, I want to reply to another student's comment, so
   that I can answer their question or continue the conversation.
4. As an enrolled student, I want to edit my own comment after posting, so
   that I can fix typos or clarify what I meant.
5. As an enrolled student, I want to delete my own comment, so that I can
   retract something I no longer want to say.
6. As an enrolled student, I want to see new comments appear without manual
   refresh, so that an active discussion feels alive.
7. As an enrolled student, I want URLs in comments to be auto-linkified, so
   that I can share resources without extra formatting work.
8. As an enrolled student, I want a clear empty state on a course with no
   discussion yet, so that I'm encouraged to start the conversation.
9. As an enrolled student, I want to see only up to 3 replies per top-level
   comment by default with a "View N more replies" expander, so that the page
   stays scannable on busy threads.
10. As an enrolled student, I want top-level comments newest-first and replies
    oldest-first, so that fresh discussion is up top and reply threads read in
    chronological order.
11. As an enrolled student, I want a 2000-character cap with feedback as I
    type, so that I know when I'm about to hit the limit.
12. As an enrolled student, I want to load more comments via pagination, so
    that I can browse older discussion without the page hanging.
13. As a non-enrolled visitor, I want the Discussion tab to be hidden on
    courses I haven't bought, so that I'm not shown UI I cannot use.
14. As a course author, I want to participate in my course's discussion
    without being enrolled as a student, so that I can answer questions and
    engage the cohort.
15. As a course author, I want to delete any comment on my course, so that I
    can remove spam, abuse, or off-topic content.
16. As an admin, I want to read and post in any course's discussion, so that
    I can support students and moderate platform-wide.
17. As an admin, I want to delete any comment in any course, so that I can
    moderate the platform.
18. As an admin in `courseStudentMode`, I want the same access as a normal
    enrolled student, so that the existing student-mode behavior is honored.
19. As an admin, I want a global toggle in Platform Customization to enable
    or disable course discussions for the whole platform, so that I can turn
    the feature off if my organization doesn't want it.
20. As an admin, when I disable discussions globally, I want the tab to
    disappear from every course, so that students don't see a broken or
    empty feature.
21. As any reader, I want a deleted parent comment with replies to keep a
    `[deleted]` shell, so that the surviving replies still have context.
22. As any reader, I want a deleted comment with no replies to disappear
    entirely, so that the thread doesn't fill up with empty placeholders.
23. As any reader, I want each comment to show the author's avatar, name,
    timestamp, and (if I'm the author) edit/delete affordances, so that I
    have all the context I need on each row.
24. As a course author or admin, I want a comment count badge on the
    Discussion tab, so that I can tell at a glance whether discussion is
    active without opening the tab.
25. As any visitor to a course page, I want to see avatars of the most
    recent students who completed the course in the hero, so that I can
    gauge whether real people finish this course.
26. As any visitor, I want completer avatars to show without names, so that
    individual completion is not exposed publicly for privacy reasons.
27. As any visitor, I want the "Completed:" element hidden when nobody has
    finished, so that the hero doesn't display a misleading empty state.
28. As any visitor, I want a `+X` overflow indicator only when more than
    three students have completed, so that the element accurately reflects
    the size of the completer set.
29. As any visitor, I want the "Completed:" element to be visible regardless
    of the discussions toggle, so that social proof remains even if comments
    are disabled.
30. As a developer/operator, I want comments to be tenant-scoped at the
    database level, so that data from one tenant cannot leak to another.
31. As a developer/operator, I want soft deletion via `deletedAt`, so that
    moderation actions are reversible if needed.
32. As a developer/operator, I want a denormalized `replyCount` on the
    comment row, so that listing a thread doesn't require N additional
    aggregate queries.

## Implementation Decisions

### Backend — new `courseComments` NestJS module

- Lives alongside existing feature modules (`apps/api/src/courseComments`)
  with the standard controller / service / repository / schemas /
  migration layout used by sibling modules (`qa`, `news`, `articles`).
- **Tables**:
  - `courseComments`: `id`, `tenantId`, `courseId`, `authorId`,
    `parentCommentId` (nullable), `content`, `replyCount` (denormalized),
    `createdAt`, `updatedAt`, `deletedAt` (nullable, soft delete).
  - Index: `(tenantId, courseId, parentCommentId, createdAt DESC)` to
    serve the primary listing query.
- **Depth**: maximum reply depth of 1, enforced server-side. Posting a
  reply to a row that already has a non-null `parentCommentId` is
  rejected.
- **Soft delete**: `deletedAt` is set on delete. Listing queries filter
  out soft-deleted rows that have no replies; soft-deleted parents that
  still have replies are returned with their content replaced by a
  `[deleted]` shell at the API serialization boundary.

### Permissions — reuse existing pattern, no new guard

- Reuses the `studentCourses` join +
  `permissionsService.getUserAccess` + `canUseLearnerProgress` pattern
  established in the existing lesson service. The same rule governs
  read and write: enrolled student, course author, or admin (admins in
  `courseStudentMode` follow the same path normal students do).
- Mutations (create / edit / delete) require the same access; ownership
  checks (edit-own, delete-own) are layered on top.
- Course-author and admin can delete any comment on a course they own /
  on the platform; admin moderation uses the existing role check.

### API contract

- `GET    /courses/:courseId/comments` — cursor pagination, 20 per
  page; cursor is `(createdAt, id)`. Top-level rows newest first; each
  row includes up to 3 inlined replies oldest first plus the total
  `replyCount`.
- `GET    /courses/:courseId/comments/:id/replies` — paginated replies
  for a single parent (used by the "View N more replies" expander).
- `POST   /courses/:courseId/comments` — create top-level or reply
  (body carries optional `parentCommentId`).
- `PATCH  /comments/:id` — edit content (author only).
- `DELETE /comments/:id` — soft delete (author, course author, or
  admin).
- `GetCourseResponse` gains a `commentCount` field driving the tab
  badge. The count reflects non-deleted comments (top-level and
  replies).

### Settings — global discussions toggle

- New boolean `discussionsEnabled` in the platform settings JSONB
  blob, mirroring the existing `qaEnabled` pattern in the settings
  constants and schema.
- New PATCH endpoint under the existing settings controller
  (`/settings/discussions/:setting` style, matching the established
  Q&A/News/Articles route shape).
- Default value: enabled.
- The course detail response surfaces the effective flag so the web
  client can hide the tab without a second roundtrip.

### Web — Discussion tab + thread UI

- New `apps/web/app/modules/Courses/Discussion` folder housing the
  tab content, thread list, comment row, reply list, composer, and
  associated React Query hooks.
- New "Discussion" tab is added to the course view tabs alongside
  Chapters / More from Author / Statistics.
  - Hidden when `discussionsEnabled` is false.
  - Hidden when the viewer is not enrolled / not the author / not an
    admin.
  - Tab label shows a badge with `commentCount`.
- Composer: plain `<textarea>`, 2000-char cap with live counter,
  submit disabled while empty or while pending; new comments are
  **non-optimistic** (inline spinner, wait for server confirmation).
- Polling: React Query `refetchInterval` of 30 seconds for the thread
  query; no WebSockets, no notifications in v1.
- Empty state: illustration + "Start the conversation" copy + CTA
  that focuses the composer.
- All user-facing strings go through the existing i18n layer.
- Auto-linkify URLs in rendered content; render line breaks; no other
  markdown.

### Web — Hero "Completed:" element

- Lives in the existing `CourseOverview.tsx` next to the rest of the
  hero content, visible to everyone (enrolled or not).
- Sourced from `studentCourses` ordered by `completedAt DESC NULLS LAST`.
- The course detail response surfaces both the top-3 completer
  avatars (avatar URL only — no names) and the total completer count.
- Rendering rules:
  - 0 completers → element hidden entirely.
  - 1–3 completers → show those avatars, no `+X`.
  - 4+ completers → show 3 avatars plus `+X` where `X = total - 3`.
- Independent of the `discussionsEnabled` toggle.

### Admin UI

- New `SettingItem` row in the existing Customize Platform tab
  alongside Q&A / News / Articles toggles.
- New `useChangeDiscussionsSetting` mutation hook calling the new
  settings PATCH endpoint, modeled on the existing
  `useChangeQASetting` hook.

### Modules / boundaries

- **`courseComments` service (deep module)**: encapsulates
  permission resolution (delegating to the existing permissions
  service), depth enforcement, denormalized counter maintenance,
  soft-delete shell logic, and cursor pagination. Tested at this
  boundary.
- **`courseComments` controller**: thin HTTP layer; tested only
  through the e2e suite.
- **`courseComments` repository**: thin Drizzle/SQL layer; covered
  via the service tests.
- **Web `Discussion` module**: composer, thread list, comment row,
  reply list, and the React Query hooks. One web smoke test covers
  render-tab + post-comment.
- **Settings**: extends the existing settings module rather than
  introducing a new one.

### Rate limiting & security

- Reuses the existing global rate limit; no per-endpoint custom
  limit in v1.
- Tenant scoping is enforced at the repository layer; every query
  filters by `tenantId`.
- Content is stored as plain text; the renderer is responsible for
  escaping plus auto-linkification, matching how other plain-text
  content is rendered today.

### Tests

- API e2e (in the new module's spec directory):
  - Enrolled student creates a top-level comment → 201.
  - Non-enrolled user creates a comment → 403.
  - Author edits own comment → 200; edits another user's comment → 403.
  - Admin deletes any comment → 200, soft-delete observed.
  - Cursor pagination returns expected ordering and `nextCursor`.
- Web: one smoke test covering rendering the Discussion tab and
  posting a comment.

## Out of Scope

- Notifications (email, in-app, or push) for replies or mentions.
- Real-time updates via WebSockets / Server-Sent Events; polling
  only in v1.
- Likes, reactions, mentions, attachments, images, videos, file
  uploads.
- Rich-text or markdown formatting beyond auto-linkified URLs and
  line breaks.
- Threading deeper than one level (no replies-to-replies).
- Per-course or per-author override of the global
  `discussionsEnabled` flag.
- Reporting / flagging UI for end users.
- Per-endpoint rate limiting beyond the existing global limit.
- Translations / localization of comment **content**; UI strings are
  i18n'd, user-authored content is not.
- Search inside discussions.
- Pinning, sticky comments, or sorting modes other than the fixed
  newest-first / oldest-first reply ordering.
- Lesson-level or chapter-level discussions.
- Names on the hero "Completed:" avatars (privacy-preserving by
  design).
- Backfill of the `commentCount` denormalized counter for historical
  data (no historical data exists).

## Further Notes

- The discussions feature and the hero "Completed:" element ship
  together but are conceptually independent: the toggle controls
  only discussions; completer avatars are always-on social proof.
- The denormalized `replyCount` column is the source of truth for
  list rendering. It is updated inside the same transaction as the
  underlying mutation to avoid drift.
- The soft-delete shell (`[deleted]` placeholder where replies
  exist) is computed at serialization time, not stored on the row,
  so an admin restore is a simple `deletedAt = NULL`.
- Polling interval (30s) is conservative; if load becomes a concern
  we can lengthen it or switch to event-driven invalidation later
  without changing the data model.
- Permission reuse means there is exactly one place to change the
  enrollment / author / admin rule if it ever evolves.
- Cursor pagination on `(createdAt, id)` is stable under inserts;
  the index `(tenantId, courseId, parentCommentId, createdAt DESC)`
  serves both the top-level listing and the replies-of-parent query.
