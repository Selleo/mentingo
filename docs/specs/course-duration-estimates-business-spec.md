# Course Duration Estimates Business Spec

## Business Overview

Course duration estimates help learners and course managers understand the expected time commitment before starting or assigning training. Mentingo calculates the estimate from the actual lesson content and exposes it as a language-neutral number of minutes so each user interface can format it appropriately for the learner's locale.

## Who Uses It

- Learners compare available courses by expected time commitment before choosing what to study.
- Course creators review how much learner time a course is likely to require as its content changes.
- L&D managers use estimated duration when planning and assigning training.

## Feature Functions

- Estimate lesson duration from readable content, embedded resources, lesson type, and quiz questions.
- Sum lesson estimates into chapter and course totals.
- Return course-list duration estimates as a number of minutes.
- Recalculate estimates from current course content instead of relying on a fixed duration.
- Support localized lesson descriptions when estimating reading time.
- Display hour and minute units in the learner's interface language.
- Confirm course completion in the progress card instead of showing zero remaining time.

## End-User Value

Learners get a clearer expectation of the effort required, while L&D teams can plan training workloads using estimates based on the course itself. Returning minutes without a preformatted label also lets each interface present the duration consistently in the user's language.

## How It Works

When Mentingo prepares course data, it evaluates the lessons in each course, estimates the time needed for reading and interactive resources, and adds those estimates together. Course-list responses expose the result in minutes. The frontend turns that number into a localized label using language-specific hour and minute abbreviations. After the learner completes every chapter, the progress card replaces the zero-time estimate with a localized course-finished message.

## Key Technical Context

- Duration estimation is implemented in `apps/api/src/courses/course.service.ts`.
- Estimation heuristics account for reading speed, videos, images, downloads, presentations, quizzes, AI mentor lessons, and embedded lessons.
- Hierarchical estimates retain seconds internally for lesson and chapter calculations, while course-list estimates are rounded up to whole minutes.
- The API no longer constructs an English formatted duration label for these course-list estimates.
- Shared course duration formatters receive the active interface translator and are used across course overview, progress, chapter, and statistics surfaces.
- The course overview determines completion from completed chapters and provides the finished message in every supported interface language.

## Test Evidence

- Course controller E2E coverage verifies that content creator course responses use a calculated one-minute estimate instead of a fixed duration.
- The duration calculation has API coverage for lesson and chapter hierarchy values.
- Progress-card component coverage verifies both remaining-time presentation and the completed-course message.
- Dedicated frontend E2E coverage for localized duration presentation was not identified.
