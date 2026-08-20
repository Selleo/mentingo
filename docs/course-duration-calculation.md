# Course Duration Calculation

This is the canonical technical reference for Mentingo's course duration estimates. Exact values are stored and exchanged internally as integer seconds. Display rounding is a presentation concern and is intentionally not persisted.

## Constants

| Constant                |         Value | Meaning                                                                                                 |
| ----------------------- | ------------: | ------------------------------------------------------------------------------------------------------- |
| Words per minute        |         `200` | Reading-speed assumption for visible lesson text                                                        |
| Video fallback          | `180` seconds | Estimate for an internal video with missing/invalid metadata, an unresolved video, or an external video |
| Image occurrence        |  `15` seconds | Fixed contribution per embedded image                                                                   |
| Download occurrence     |  `30` seconds | Fixed contribution per embedded downloadable file                                                       |
| Presentation occurrence | `180` seconds | Fixed contribution per embedded presentation                                                            |
| Quiz question           |  `60` seconds | Added per question, in addition to lesson text reading time                                             |
| AI Mentor lesson        | `600` seconds | Added to the lesson's text reading time                                                                 |
| Embed lesson            | `180` seconds | Added to the lesson's text reading time                                                                 |
| Duration display bucket | `900` seconds | Fifteen-minute learner-facing presentation increment; not an exact stored duration                      |

The source of truth for backend heuristic constants is `apps/api/src/courses/constants/duration-defaults.ts`. The shared frontend display and aggregation helpers are in `apps/web/app/modules/Courses/utils/formatDuration.ts`.

## Lesson formula

For localized lesson HTML, count the visible words after removing markup and calculate:

```text
readingSeconds = ceil(wordCount / 200 * 60)
```

For each embedded occurrence, add the contribution for its resource kind. An internal video contributes `ceil(resource.metadata.durationSeconds)` when the server-owned value is finite and positive; otherwise it contributes the 180-second fallback. A resource relationship without an actual embedded content reference contributes nothing. Every repeated embedded occurrence is counted.

Lesson-type additions are applied as follows:

```text
CONTENT = readingSeconds
         + video occurrences
         + image occurrences
         + download occurrences
         + presentation occurrences
         + quizQuestionCount * 60

QUIZ = readingSeconds + quizQuestionCount * 60
AI_MENTOR = readingSeconds + 600
EMBED = readingSeconds + 180
SCORM or live training = readingSeconds
```

The SCORM/live-training behavior is intentionally unchanged: there is no dedicated duration rule in this issue. A quiz question adds time to the existing reading estimate; AI Mentor and embed lesson additions also retain their existing text reading time.

## Language selection and aggregation

The projection owner evaluates exactly the course's deduplicated base language plus available locales and preserves the course's language fallback behavior: use the requested language when it is available, otherwise use the course base language. Missing localized content falls back to the base-language description while fixed lesson/resource contributions still follow the lesson rules.

Exact values are aggregated without display rounding. An exact chapter duration is the sum of its exact lesson durations; the 900-second value below is used only when presenting a duration:

```text
exactChapterSeconds = sum(exactLessonSeconds in chapter)
exactCourseSeconds = sum(exactChapterSeconds for every chapter)
```

Lesson, chapter, and course projections use the same language-keyed `{ totalSeconds }` shape. Course-list APIs retain `estimatedDurationMinutes` for compatibility, derived from the rounded chapter projections rather than by rounding only the exact course total.

## Learner-facing display invariant

For a positive exact duration, round each chapter independently:

```text
displayedChapterSeconds = ceil(exactChapterSeconds / 900) * 900
displayedChapterSeconds = 0 when exactChapterSeconds <= 0
displayedCourseSeconds = sum(displayedChapterSeconds for every chapter)
```

This makes the course label equal to the sum of the chapter labels. For example, two chapters of 901 seconds display as 30 minutes each and 60 minutes for the course; rounding their 1,802-second total as one value would display 45 minutes and violate the visible summation invariant.

The frontend helper `sumChapterDisplayDurations` implements the course display aggregation, and `formatDurationToDisplayBucket` implements an individual chapter label. Zero remains zero rather than becoming a 15-minute label.

## Remaining time

Remaining time is calculated at read/render time and is not persisted per learner. Completed lessons are excluded first, then each chapter's unfinished lesson seconds are summed and rounded once:

```text
remainingChapterSeconds = sum(exact seconds of incomplete lessons in chapter)
displayedRemainingSeconds = sum(
  remainingChapterSeconds > 0
    ? ceil(remainingChapterSeconds / 900) * 900
    : 0
)
```

Partial quiz answers, watched video ranges, reading progress, and other partial lesson progress do not reduce the estimate in this issue. The progress card uses `sumRemainingChapterDisplayDurations` in `apps/web/app/modules/Courses/CourseView/CourseStatBar/CourseStatBar.tsx`.

## Recalculation and video metadata

The backend refreshes the affected course hierarchy from current database state after course, chapter, lesson, question, or relevant resource metadata changes. The refresh updates lesson, chapter, and course projections together; it does not apply learner progress deltas. A video metadata worker may persist a positive integer `durationSeconds` after probing an S3 object or reading Bunny metadata, then refreshes every course whose lesson content embeds that resource. Bunny processing statuses 3 and 4 are treated as ready only when the provider also returns a positive length. Attached-but-unused resources do not trigger a duration contribution.

When a course is duplicated or shared, known source video metadata is copied to the target resource. A target Bunny resource also receives its own delayed metadata-discovery job, keyed by both the target resource and Bunny video identifiers, so a missing source duration can be filled later and a changed target video reference is not hidden by an older completed job.

Missing or invalid canonical video metadata intentionally remains on the 180-second estimate fallback. That fallback is only a learning-time estimate and is never an authoritative maximum for video coverage when canonical metadata exists. The frontend cannot set or overwrite canonical resource duration.

Production Bunny tenants must configure `BUNNY_STREAM_READ_ONLY_API_KEY` with the library's read-only key. It is used for v1 webhook HMAC verification and is required independently from `BUNNY_STREAM_API_KEY`.

## Code and test pointers

- Heuristic constants: `apps/api/src/courses/constants/duration-defaults.ts`.
- Projection owner and language/lesson calculation: `apps/api/src/courses/course-duration.service.ts` and `apps/api/src/courses/types/duration.ts`.
- Detailed course duration mapping: `apps/api/src/courses/course.service.ts`.
- Shared 15-minute formatting, chapter aggregation, and remaining-time grouping: `apps/web/app/modules/Courses/utils/formatDuration.ts`.
- Detailed course surfaces: `apps/web/app/modules/Courses/CourseView/CourseOverview/CourseDescriptionModal.tsx`, `CourseCategoryEditor.tsx`, `TableOfContent/ChapterItem.tsx`, and `CourseStatBar/CourseStatBar.tsx`.
- List/card surfaces: `apps/web/app/modules/Courses/components/modern/ModernCoursesView.tsx` and the modern card/carousel components in the same directory.
- Focused boundary and summation tests: `apps/web/app/modules/Courses/utils/__tests__/formatDuration.test.ts`.
- Visible component coverage: the course overview, chapter item, author modal, and progress-stat-card tests beside their components.
- Backend duration hierarchy and refresh evidence: `apps/api/src/courses/__tests__/course.controller.e2e-spec.ts`.

When a constant, fallback, formula, projection shape, or display invariant changes, update this reference and its focused tests in the same change.
