# Learning Time Tracking Business Spec

## Business Overview

Learning Time Tracking records how long learners actively spend in lessons. It turns lesson activity into reporting data that helps course managers and L&D teams understand learner engagement beyond simple completion status.

The feature supports course statistics by showing average learning time and per-student learning-time tables.

## Who Uses It

- Learners whose active lesson time is tracked while they study.
- Course managers who review learning-time statistics for a course.
- HR and L&D administrators who use time-spent data to understand engagement.
- Platform operators who rely on asynchronous processing to keep tracking reliable at scale.

## Feature Functions

- Start tracking when a learner opens a lesson.
- Send periodic heartbeats while the learner is active and the browser tab is visible.
- Stop counting when the learner is idle, leaves the lesson, disconnects, or closes the page.
- Queue accumulated learning time for asynchronous persistence.
- Accumulate multiple time updates for the same learner and lesson.
- Report total learning time per student for a course.
- Filter and sort course learning-time statistics by learner, group, search, and total time.
- Exclude course managers and authors from learner-time tracking.

## End-User Value

L&D teams can see whether learners are spending meaningful time with course material, not just whether they clicked through it. Course managers can identify learners who may need support and compare time investment across cohorts or groups.

## How It Works

When a learner opens a lesson, the web app joins a lesson tracking session over WebSocket. While the learner is active, the browser sends heartbeat events every few seconds. The backend accumulates active time in a short-lived session and periodically queues updates for persistence.

Queued jobs add time to the learner’s lesson total. If the learner leaves the lesson or disconnects, any remaining accumulated time is flushed. Course statistics then use the stored totals to display average course learning time and per-student learning-time reports.

The tracker ignores users with course authoring permissions so administrative preview or editing activity does not inflate learner engagement metrics.

## Key Technical Context

- Frontend tracking is implemented in `apps/web/app/hooks/useLearningTimeTracker.ts` and is invoked from the lesson page.
- Backend tracking lives under `apps/api/src/learning-time`.
- The worker processes `learning-time` BullMQ jobs and runs tenant-scoped updates when a tenant ID is available.
- Course learning-time reports are exposed through `/api/course/:courseId/statistics/learning-time` and require `COURSE_STATISTICS`.
- Learning-time data also contributes to course statistics overview values such as average learning time.

## Test Evidence

- API E2E coverage verifies learning-time queue processing, accumulation from multiple jobs, and parallel handling for different users.
- Course controller E2E coverage verifies learning-time statistics exclude deleted students.
- Web E2E coverage verifies the course statistics learning-time table is visible in the admin course-statistics workflow. No dedicated frontend E2E spec was found for WebSocket heartbeat timing itself.
