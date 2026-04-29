# Discussions Full Feature

## Type

#AFK

## What to build

End-to-end course Discussion tab: schema, full backend CRUD (top-level
and replies), permissions, tenant scoping, soft-delete shell, web tab UI
with composer, thread list, replies expander, polling, auto-linkify, and
the comment count badge.

See parent PRD `course-discussions-prd.md` sections:

- "Backend — new `courseComments` NestJS module"
- "Permissions — reuse existing pattern, no new guard"
- "API contract" (all endpoints **except** the discussions toggle)
- "Web — Discussion tab + thread UI"
- "Modules / boundaries" (`courseComments` service/controller/repo +
  Web `Discussion` module)

The global `discussionsEnabled` toggle and admin Customize Platform UI
are **out of scope** for this slice — handled in the toggle issue. The
hero "Completed:" element is also out of scope.

## Acceptance criteria

- [ ] `courseComments` table + index migration applied
- [ ] `courseComments` NestJS module (controller / service / repository /
      schemas) wired up alongside existing feature modules
- [ ] `GET /courses/:courseId/comments` cursor-paginated (20/page),
      top-level newest-first, each row inlines up to 3 replies
      oldest-first plus total `replyCount`
- [ ] `GET /courses/:courseId/comments/:id/replies` paginated
- [ ] `POST /courses/:courseId/comments` creates top-level or reply
      (carries optional `parentCommentId`); depth=1 enforced server-side
- [ ] `PATCH /comments/:id` edits content (author only)
- [ ] `DELETE /comments/:id` soft-deletes (author, course author, or
      admin); `deletedAt` set
- [ ] Permission rule reuses `studentCourses` + `getUserAccess` +
      `canUseLearnerProgress`; admin in `courseStudentMode` follows the
      same path as a student
- [ ] Non-enrolled user → 403 on read and write
- [ ] Tenant scoping enforced at repository layer (every query filters
      by `tenantId`)
- [ ] `replyCount` denormalized counter maintained inside the same
      transaction as create/delete
- [ ] Soft-deleted parent with replies serialized as `[deleted]` shell;
      soft-deleted leaf with no replies omitted entirely
- [ ] `GetCourseResponse.commentCount` field added (non-deleted count,
      top-level + replies)
- [ ] Discussion tab added to course view tabs alongside Chapters / More
      from Author / Statistics
- [ ] Tab hidden when viewer is not enrolled / not the author / not an
      admin
- [ ] Tab label shows badge with `commentCount`
- [ ] Composer is a plain `<textarea>` with 2000-char cap, live counter,
      submit disabled while empty or pending; non-optimistic submit with
      inline spinner
- [ ] Thread list renders newest-first top-level rows with up to 3
      inlined replies oldest-first; "View N more replies" expander loads
      paginated replies
- [ ] Edit/delete affordances on author's own comments; course author
      and admin see delete on any comment
- [ ] Empty state: illustration + "Start the conversation" copy + CTA
      that focuses the composer
- [ ] React Query `refetchInterval` of 30 seconds on the thread query
- [ ] URLs auto-linkified in rendered content; line breaks rendered;
      no other markdown
- [ ] All user-facing strings go through the existing i18n layer
- [ ] API e2e tests: enrolled student creates top-level → 201;
      non-enrolled → 403; author edits own → 200, edits other → 403;
      admin deletes any → 200 with soft-delete observed; cursor
      pagination ordering and `nextCursor` correct
- [ ] Web smoke test: render Discussion tab and post a comment

## Blocked by

None - can start immediately.

## User stories addressed

- User story 1
  - "As an enrolled student, I want to see a Discussion tab on the
    course page, so that I can talk to other learners taking the same
    course."
- User story 2
  - "As an enrolled student, I want to post a top-level comment on a
    course, so that I can ask a question or share a thought with the
    cohort."
- User story 3
  - "As an enrolled student, I want to reply to another student's
    comment, so that I can answer their question or continue the
    conversation."
- User story 4
  - "As an enrolled student, I want to edit my own comment after
    posting, so that I can fix typos or clarify what I meant."
- User story 5
  - "As an enrolled student, I want to delete my own comment, so that I
    can retract something I no longer want to say."
- User story 6
  - "As an enrolled student, I want to see new comments appear without
    manual refresh, so that an active discussion feels alive."
- User story 7
  - "As an enrolled student, I want URLs in comments to be
    auto-linkified, so that I can share resources without extra
    formatting work."
- User story 8
  - "As an enrolled student, I want a clear empty state on a course
    with no discussion yet, so that I'm encouraged to start the
    conversation."
- User story 9
  - "As an enrolled student, I want to see only up to 3 replies per
    top-level comment by default with a 'View N more replies' expander,
    so that the page stays scannable on busy threads."
- User story 10
  - "As an enrolled student, I want top-level comments newest-first and
    replies oldest-first, so that fresh discussion is up top and reply
    threads read in chronological order."
- User story 11
  - "As an enrolled student, I want a 2000-character cap with feedback
    as I type, so that I know when I'm about to hit the limit."
- User story 12
  - "As an enrolled student, I want to load more comments via
    pagination, so that I can browse older discussion without the page
    hanging."
- User story 13
  - "As a non-enrolled visitor, I want the Discussion tab to be hidden
    on courses I haven't bought, so that I'm not shown UI I cannot use."
- User story 14
  - "As a course author, I want to participate in my course's
    discussion without being enrolled as a student, so that I can
    answer questions and engage the cohort."
- User story 15
  - "As a course author, I want to delete any comment on my course, so
    that I can remove spam, abuse, or off-topic content."
- User story 16
  - "As an admin, I want to read and post in any course's discussion,
    so that I can support students and moderate platform-wide."
- User story 17
  - "As an admin, I want to delete any comment in any course, so that
    I can moderate the platform."
- User story 18
  - "As an admin in `courseStudentMode`, I want the same access as a
    normal enrolled student, so that the existing student-mode behavior
    is honored."
- User story 21
  - "As any reader, I want a deleted parent comment with replies to
    keep a `[deleted]` shell, so that the surviving replies still have
    context."
- User story 22
  - "As any reader, I want a deleted comment with no replies to
    disappear entirely, so that the thread doesn't fill up with empty
    placeholders."
- User story 23
  - "As any reader, I want each comment to show the author's avatar,
    name, timestamp, and (if I'm the author) edit/delete affordances,
    so that I have all the context I need on each row."
- User story 24
  - "As a course author or admin, I want a comment count badge on the
    Discussion tab, so that I can tell at a glance whether discussion
    is active without opening the tab."
- User story 30
  - "As a developer/operator, I want comments to be tenant-scoped at
    the database level, so that data from one tenant cannot leak to
    another."
- User story 31
  - "As a developer/operator, I want soft deletion via `deletedAt`, so
    that moderation actions are reversible if needed."
- User story 32
  - "As a developer/operator, I want a denormalized `replyCount` on
    the comment row, so that listing a thread doesn't require N
    additional aggregate queries."
