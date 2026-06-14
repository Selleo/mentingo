# Lesson Delivery And Learning Mode Business Spec

## Business Overview

Lesson delivery and learning mode let learners start a course, move through lessons, complete learning activities, and build progress toward course completion. The feature covers the learner lesson page, navigation between lessons, lesson sequencing rules, completion behavior, and learning-time tracking.

For HR and L&D teams, this is where assigned learning turns into measurable activity. It helps learners follow the intended course flow, prevents premature access when sequencing is required, and records completion so admins can later report on training progress.

The main workflow starts when a learner opens a course and clicks start learning. Mentingo opens the first available lesson, renders the right lesson type, tracks active learning time, marks lessons complete when the learner satisfies the lesson rules, and moves the learner through the course.

## Who Uses It

- Learners use it to take course lessons and continue training.
- L&D admins configure lesson sequence and course settings that shape learner flow.
- Content creators preview learning mode to verify the course experience.
- Reporting users rely on the resulting progress, completion, and learning-time data.

## Feature Functions

- Start a course from the course overview and open the correct lesson.
- Render content, quiz, AI mentor, embed, SCORM, and live training lesson types.
- Navigate to previous and next lessons from the learner lesson page.
- Enforce lesson sequencing when a course requires ordered completion.
- Mark lessons complete automatically or after lesson-specific completion rules.
- Track active learning time with heartbeat-based session tracking.
- Update chapter and course progress when lessons are completed.

## End-User Value

Learners get a clear, guided training experience instead of a disconnected set of content pages. HR and L&D teams get more reliable completion data because lesson access, progress, and course completion follow explicit rules.

Learning-time tracking adds a reporting signal beyond simple completion, helping teams understand participation and time investment.

## How It Works

The learner lesson page loads the current course and lesson in the selected language. It renders the correct lesson player and shows course navigation, chapter context, and a lesson sidebar.

For simple content and embed lessons, Mentingo can mark the lesson complete automatically when the learner opens the lesson or finishes the final video. Quiz and AI mentor lessons require their own completion checks before progress advances. When sequence mode is enabled, the learner cannot skip ahead until previous lessons are complete, and failing a required quiz keeps the next lesson locked.

While the lesson page is open, the web app sends learning-time heartbeats over the shared socket connection. The backend records active learning sessions and queues periodic learning-time updates.

## Key Technical Context

- Learner lesson UI lives in `apps/web/app/modules/Courses/Lesson`.
- The lesson route is `/course/:courseId/lesson/:lessonId`, with a layout loader that redirects unauthenticated users to login.
- Lesson access is guarded by `LEARNING_PROGRESS_UPDATE` or `LEARNING_MODE_USE` at route/API level, while the lesson route itself is public so the layout can handle redirects.
- Progress mutations use `apps/api/src/studentLessonProgress/studentLessonProgress.controller.ts` and `studentLessonProgress.service.ts`.
- Learning-time tracking uses `apps/web/app/hooks/useLearningTimeTracker.ts` and `apps/api/src/learning-time`.
- Completion publishes lesson, chapter, and course completion events through the existing outbox flow.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/learning` cover starting learning, continuing to the next content lesson, opening lessons out of order when sequence is disabled, blocking skipped lessons when sequence is enabled, keeping the next lesson locked after a failed required quiz, completing embed lessons, and SCORM launch/resume/completion.

Backend E2E tests in `apps/api/src/learning-time/__tests__/learning-time.e2e-spec.ts` cover learning-time queue processing, accumulation across jobs, and parallel updates for different users.
