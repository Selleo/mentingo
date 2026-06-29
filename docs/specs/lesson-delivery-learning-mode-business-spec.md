# Lesson Delivery And Learning Mode Business Spec

## Business Overview

Lesson delivery and learning mode are the learner-facing course experience. They let learners start a course, move through lessons, complete activities, respect sequencing rules, and build measurable progress toward course completion.

For HR and L&D teams, this is where assigned training becomes evidence of learning activity. The feature guides learners through the intended flow, prevents premature access when sequencing is enabled, and records progress for later reporting.

The main workflow starts when a learner opens a course and chooses to start or continue learning. Mentingo opens the right lesson, renders the correct lesson type, tracks active learning time, completes lessons when the rules are satisfied, and moves the learner through the course.

## Who Uses It

- Learners take course lessons, answer quizzes, complete embedded or SCORM content, and continue training.
- L&D administrators configure sequencing and course settings that shape the learner flow.
- Content creators preview the learning experience before or after publishing.
- Reporting users rely on the resulting progress, completion, and learning-time data.

## Feature Functions

- Start or continue a course from the course overview.
- Render content, quiz, AI mentor, embed, SCORM, and live training lessons.
- Control lesson videos with focused keyboard shortcuts for play, seeking, volume, mute, restart, and fullscreen.
- Navigate to previous and next lessons from the learner lesson page.
- Enforce lesson sequencing when ordered completion is enabled.
- Keep later lessons locked after unmet requirements, such as a failed required quiz.
- Mark lessons complete automatically or after lesson-specific completion criteria.
- Update chapter and course progress as lessons are completed.
- Track active lesson time while the learner studies.

## End-User Value

Learners get a clear, guided training experience instead of disconnected content pages. HR and L&D teams get more reliable progress and completion data because lesson access, completion, and navigation follow explicit rules.

Learning-time tracking adds another reporting signal, helping teams understand both completion and time investment.

## How It Works

The lesson page loads the selected course and lesson in the active content language. It shows the lesson content, chapter context, navigation controls, and the course lesson sidebar.

Each lesson type has its own completion behavior. Content and embed lessons can complete when opened or when required video content finishes. Quiz lessons depend on quiz submission and passing rules. AI mentor, SCORM, and live training lessons use their own lesson-specific state. When sequence mode is enabled, Mentingo blocks access to later lessons until earlier lessons are complete.

For content videos, opening the video focuses the player so learners can use familiar playback shortcuts while the player is active, without those shortcuts taking over the rest of the lesson page.

While the learner studies, the page also runs the learning-time tracker. Completion events update lesson, chapter, and course progress and can trigger downstream completion behavior such as certificates or reporting updates.

## Key Technical Context

- Learner lesson UI lives in `apps/web/app/modules/Courses/Lesson`.
- The route is `/course/:courseId/lesson/:lessonId`.
- Lesson rendering is centralized in `LessonContentRenderer`.
- Rich-text lesson videos use the shared `VideoPlayer` component for playback controls and focused keyboard shortcuts.
- Lesson access and progress updates use `PERMISSIONS.LEARNING_PROGRESS_UPDATE` and `PERMISSIONS.LEARNING_MODE_USE`.
- Progress updates are handled through `apps/api/src/studentLessonProgress`.
- Learning-time tracking uses `apps/web/app/hooks/useLearningTimeTracker.ts` and `apps/api/src/learning-time`.

## Test Evidence

- Web E2E coverage verifies starting learning, continuing to the next content lesson, opening lessons out of order when sequence is disabled, blocking skipped lessons when sequence is enabled, keeping the next lesson locked after a failed required quiz, submitting and retaking quizzes, completing embed lessons, accessing AI mentor entry points, and SCORM launch/resume/completion behavior.
- API E2E coverage verifies quiz feedback visibility rules, lesson completion restrictions for authors/admins outside learning mode, admin/content-creator learning-mode behavior, quiz submission rules, quiz lesson deletion with submitted answers, and learning-time queue processing.
