# Course Discussions Manual QA

## Type

#HITL

## What to build

End-to-end manual QA pass across all Course Discussions slices and the
hero "Completed:" element, exercising the permission matrix, soft-delete
behavior, the global toggle, and rendering rules with real users in a
staging-like environment.

See parent PRD `course-discussions-prd.md` for full feature spec and
permission rules.

## Acceptance criteria

### Discussion tab visibility

- [ ] Tab visible to enrolled student
- [ ] Tab visible to course author (without enrollment)
- [ ] Tab visible to admin
- [ ] Tab visible to admin in `courseStudentMode` (same access path as
      student)
- [ ] Tab hidden to non-enrolled visitor
- [ ] Tab hidden on every course when `discussionsEnabled` is false
- [ ] Tab label shows accurate `commentCount` badge

### Posting comments

- [ ] Enrolled student can post a top-level comment
- [ ] Comment appears with avatar, name, timestamp
- [ ] 2000-char cap enforced with live counter feedback
- [ ] Submit disabled while empty or while pending; spinner shown
- [ ] Non-enrolled user cannot post (server returns 403; UI prevents
      attempt)

### Replies

- [ ] Reply to a top-level comment appears under it
- [ ] Reply to a reply rejected (depth=1 enforced)
- [ ] Up to 3 replies inlined oldest-first
- [ ] "View N more replies" expander loads remaining replies via
      pagination
- [ ] Top-level rows ordered newest-first

### Edit / delete (own)

- [ ] Author can edit own comment; updated content appears
- [ ] Author cannot edit another user's comment (no UI affordance, 403
      from API)
- [ ] Author can delete own comment (soft delete)

### Moderation

- [ ] Course author can delete any comment on their course
- [ ] Admin can delete any comment in any course
- [ ] Soft-deleted parent with replies shows `[deleted]` shell with
      replies still visible
- [ ] Soft-deleted leaf with no replies disappears entirely

### Pagination

- [ ] Older comments load via cursor pagination
- [ ] No duplicates and no skips across page boundaries

### Polling and rendering

- [ ] New comments appear within ~30s without manual refresh
- [ ] URLs in comment content auto-linkified
- [ ] Line breaks rendered; no other markdown
- [ ] Empty state copy + CTA appears on a course with no discussion;
      CTA focuses the composer

### Tenant isolation

- [ ] Comments from one tenant do not appear in another tenant's
      course

### Global toggle

- [ ] Admin can flip `discussionsEnabled` from Customize Platform
- [ ] Disabling globally hides the tab on every course immediately
      after a refresh
- [ ] Re-enabling restores the tab without data loss

### i18n

- [ ] All UI strings render in the active locale (spot-check at least
      two locales)

### Hero "Completed:" element

- [ ] 0 completers → element hidden
- [ ] 1–3 completers → avatars shown, no `+X`
- [ ] 4+ completers → 3 avatars plus `+X` where `X = total - 3`
- [ ] Avatars show without names
- [ ] Visible to non-enrolled visitor, enrolled student, author, and
      admin
- [ ] Visible regardless of `discussionsEnabled` state

## Blocked by

- Blocked by `discussions-full-feature-issue.md`
- Blocked by `discussions-toggle-issue.md`
- Blocked by `hero-completed-issue.md`

## User stories addressed

All Course Discussions PRD user stories (1–32) are exercised by this
manual QA pass.
