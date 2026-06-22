# Learning Time Tracking Business Spec

## Business Overview

Learning Time Tracking records how long learners actively spend in lessons. It gives course managers and L&D teams an engagement signal beyond completion status, helping them understand whether learners are spending meaningful time with the material.

For HR and L&D reporting, learning time supports course statistics, per-student review, and group comparison. It helps teams identify learners who may need support and understand how training effort varies across cohorts.

The learner does not operate this feature directly. When a learner studies a lesson, Mentingo tracks active time in the background and turns it into course statistics.

## Who Uses It

- Learners generate learning-time data while actively studying lessons.
- Course managers review learning-time statistics to understand engagement in a course.
- L&D administrators compare learning time across learners and groups.
- Reporting users use time-spent data alongside completion and progress metrics.

## Feature Functions

- Track active lesson time while a learner is on a lesson page.
- Pause counting when the learner is idle, disconnected, or the browser tab is not visible.
- Flush remaining active time when the learner leaves a lesson or disconnects.
- Accumulate learning time across multiple study sessions for the same learner and lesson.
- Show per-student total learning time for a course.
- Filter and sort course learning-time statistics by learner, group, search, and total time.
- Exclude course authoring and course-management users from learner-time tracking.

## End-User Value

L&D teams can see whether learners are investing time in course material, not only whether they completed a lesson. This helps distinguish quick click-through behavior from sustained study and gives managers another signal for coaching or course improvement.

Group filtering also helps teams compare training engagement across cohorts, departments, or assigned groups.

## How It Works

When a learner opens a lesson, Mentingo starts a learning-time session over the shared realtime connection. While the learner is active and the browser tab remains visible, the page sends periodic heartbeats. If the learner becomes idle, closes the page, disconnects, or leaves the lesson, Mentingo stops counting inactive time and saves any remaining active time.

Saved time is accumulated per learner and lesson. Course statistics then summarize that data into average learning time and per-student learning-time reports.

Users with course authoring or course-management permissions are excluded from tracking so preview, editing, or administrative activity does not inflate learner engagement metrics.

## Key Technical Context

- Frontend tracking is implemented in `apps/web/app/hooks/useLearningTimeTracker.ts` and is invoked from the lesson page.
- Backend tracking lives under `apps/api/src/learning-time`.
- Realtime tracking uses lesson join, heartbeat, leave, and disconnect events.
- Accumulated time is persisted through `learning-time` queue jobs.
- Course reports are exposed through course statistics endpoints and require `PERMISSIONS.COURSE_STATISTICS`.

## Test Evidence

- API E2E coverage verifies learning-time queue processing, accumulation from multiple jobs, and parallel handling for different users.
- Course controller E2E coverage verifies learning-time statistics exclude deleted students.
- Web E2E coverage verifies that the course statistics learning-time table appears in the admin course-statistics workflow.
- I did not find dedicated frontend E2E coverage for realtime heartbeat timing.
