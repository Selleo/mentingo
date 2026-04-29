# Hero "Completed:" Element

## Type

#AFK

## What to build

Social-proof element in the course hero showing avatars of the three
most recent students who completed the course, plus a `+X` overflow
when more than three have finished. Visible to everyone (not gated on
enrollment), and independent of the discussions toggle.

See parent PRD `course-discussions-prd.md` sections:

- "Solution" → second paragraph (hero "Completed:" element)
- "Web — Hero 'Completed:' element"

This slice is independent of the discussions feature and can be
developed in parallel.

## Acceptance criteria

- [ ] Course detail response surfaces the top-3 completer avatar URLs
      (no names) and the total completer count, sourced from
      `studentCourses` ordered by `completedAt DESC NULLS LAST`
- [ ] Element rendered inside `CourseOverview.tsx` next to the rest of
      the hero content
- [ ] Visible to everyone — enrolled or not, author or not, admin or
      not
- [ ] Avatars show without names (privacy-preserving)
- [ ] 0 completers → element hidden entirely
- [ ] 1–3 completers → those avatars only, no `+X`
- [ ] 4+ completers → 3 avatars plus `+X` where `X = total - 3`
- [ ] Visibility is independent of `discussionsEnabled` (renders the
      same whether discussions are enabled or disabled)
- [ ] All user-facing strings go through the existing i18n layer

## Blocked by

None - can start immediately.

## User stories addressed

- User story 25
  - "As any visitor to a course page, I want to see avatars of the
    most recent students who completed the course in the hero, so
    that I can gauge whether real people finish this course."
- User story 26
  - "As any visitor, I want completer avatars to show without names,
    so that individual completion is not exposed publicly for privacy
    reasons."
- User story 27
  - "As any visitor, I want the 'Completed:' element hidden when
    nobody has finished, so that the hero doesn't display a
    misleading empty state."
- User story 28
  - "As any visitor, I want a `+X` overflow indicator only when more
    than three students have completed, so that the element
    accurately reflects the size of the completer set."
- User story 29
  - "As any visitor, I want the 'Completed:' element to be visible
    regardless of the discussions toggle, so that social proof
    remains even if comments are disabled."
