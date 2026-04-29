# Slice 2 — Course completion + AI mentor pass events

## Type

#AFK

## What to build

Extend the points pipeline established in slice #1 to cover the remaining two earning events:
course completion and AI mentor lesson pass. The `PointsService` from slice #1 is unchanged
beyond accepting two more `eventType` values; this slice is the listener and event-emitter
plumbing.

A new `UserAiMentorLessonPassed` event is introduced, mirroring the existing
`UserChapterFinished` / `UserCourseFinished` patterns. The AI mentor lesson progress write site
emits the event once per `(user, lesson)` when `passed` flips to `true` for the first time. A
listener subscribes to it and calls `PointsService.award` with `eventType = ai_pass`.

A second listener subscribes to the existing `UserCourseFinished` event and calls
`PointsService.award` with `eventType = course_completed`.

Default point values continue to be the hardcoded constants from slice #1 (AI pass = 30, course
= 50). Tenant configuration arrives in slice #3.

See `CURRENT-WORK/gamification-prd.md`, "Backend modules (modified)" → AI mentor event emitting
and "Backend modules (new)" → event listeners.

## Acceptance criteria

- [ ] `UserAiMentorLessonPassed` event class exists alongside the existing user events and is
  emitted only on the first transition of `aiMentorStudentLessonProgress.passed` to `true` per
  `(user, lesson)`.
- [ ] An event listener for `UserAiMentorLessonPassed` calls `PointsService.award` with
  `eventType = ai_pass` and the lesson id as `entityId`.
- [ ] An event listener for `UserCourseFinished` calls `PointsService.award` with `eventType =
  course_completed` and the course id as `entityId`.
- [ ] Idempotency from slice #1 holds for both new event types: re-passing the same AI mentor
  lesson or re-completing the same course does not produce a second ledger row or bump the
  total.
- [ ] Role gating from slice #1 holds for both new event types — staff who pass an AI lesson or
  finish a course do not accrue points.
- [ ] Integration tests fire each event type end-to-end and assert ledger row, total, and
  `lastPointAt` updates.
- [ ] Profile page total now reflects all three event types.

## Blocked by

- Blocked by #1

## User stories addressed

- User story 2
  - As a student, I want to receive points when I pass an AI mentor lesson, so that
    conversational practice counts toward my total.
- User story 3
  - As a student, I want to receive points when I finish a whole course, so that long-form
    commitment is rewarded more than incremental progress.
