# Course Duplication Business Spec

## Business Overview

Course duplication lets content teams create an editable copy of an existing course without rebuilding the curriculum manually. An admin starts from the course list, lands immediately in the new draft course, and Mentingo copies the source content in the background.

This helps HR and L&D teams reuse proven training programs for new audiences, campaigns, languages, or organizational variants. Instead of editing a live or previously assigned course, teams can start from a separate draft and adjust the duplicated version safely.

The main workflow is simple: choose a course, duplicate it, review the placeholder draft, and wait for the copied chapters, lessons, questions, resources, SCORM data, and AI mentor context to appear when background processing completes.

## Who Uses It

- HR and L&D admins duplicate onboarding or compliance courses to prepare a new version without disrupting the original course.
- Content creators duplicate a training course as a draft, then adapt lessons, settings, and language-specific content for a different audience.
- Course managers use the async status notice to understand when copied content is still being prepared and when editing can safely continue.

## Feature Functions

- Create an independent draft copy of an existing course from the admin course list.
- Redirect the user immediately to the duplicated course placeholder while content is copied in the background.
- Notify the initiating user when duplication is processing, completed, or failed.
- Refresh course list and course editor data when duplication status changes.
- Temporarily lock curriculum and settings editing while the duplicate is still being prepared or failed for the current duplication job.
- Copy course structure and supported content while excluding learner activity, enrollments, certificates, statistics, learning-path links, calendar events, and shared-course export/sync relationships.
- Keep duplication limited to the current tenant and require course creation plus manage access to the source course.

## End-User Value

Course duplication reduces repetitive authoring work and lowers the risk of accidental changes to an existing training. Teams can reuse successful learning content, adjust the copy as a draft, and keep learner progress and reporting history attached only to the original course.

Realtime status updates make the async copy understandable: the user can move to the new draft immediately, sees when editing is locked, and gets confirmation when the copied course is ready.

## How It Works

An admin or course manager duplicates a course from the admin course list. Mentingo creates a draft placeholder right away, names it after the source course with a copy suffix, and sends the user to the new course editor with the duplication job attached to the URL.

While the background job copies content, the editor shows a processing notice and blocks curriculum and settings edits. When the job completes, Mentingo removes the job parameter from the URL, refreshes course data, and shows a success notification. If the job fails, the placeholder remains visible and editing stays locked for that duplication job context.

The duplicate is designed as a separate course. It does not inherit enrollments, learner progress, quiz attempts, chat history, issued certificates, usage statistics, learning-path membership, calendar events, master export links, or readonly sync relationships from the source course.

## Key Technical Context

- The admin course list adds a Duplicate row action in `apps/web/app/modules/Admin/Courses/Courses.page.tsx`, and the editor lock state is handled in `apps/web/app/modules/Admin/EditCourse/EditCourse.tsx`.
- The API exposes `POST /api/course/:courseId/duplicate` and `GET /api/course/duplication-jobs/:jobId`, guarded by course creation permission and source-course manage access.
- Background work runs through BullMQ in the `course-duplication` queue and executes under the source tenant context.
- Realtime updates use shared `COURSE_DUPLICATION_SOCKET` constants and user-room websocket notifications.
- Content copying reuses the course snapshot and resource-copying behavior from master course synchronization, but creates fresh target entities and avoids master export mapping links.

## Test Evidence

The new unit coverage verifies that duplication is rejected before enqueueing when the source course is missing or when the actor lacks manage access to the source course.

No dedicated API E2E or Playwright E2E coverage exists yet for the full async duplication workflow. The highest-risk remaining gaps are end-to-end verification of copied course content/assets, websocket completion handling, and the failed-job editor lock state.
