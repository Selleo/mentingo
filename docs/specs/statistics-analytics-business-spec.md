# Statistics and Analytics Business Spec

## Business Overview

Statistics and Analytics gives learners, course managers, and administrators visibility into learning progress and platform performance. Learners see their own progress dashboard, while administrators see analytics dashboards and course-level reporting.

For HR and L&D teams, this feature supports progress tracking, course effectiveness review, learner follow-up, and evidence for training outcomes.

## Who Uses It

- Learners who track their own course, lesson, quiz, and activity progress.
- Course managers who review progress, quiz, AI mentor, and learning-time results for a course.
- Administrators who monitor platform-level learning analytics.
- L&D leaders who download reports or identify engagement trends.

## Feature Functions

- Show learner progress dashboards with activity streaks, quiz results, lesson progress, course progress, and next lesson context.
- Show admin analytics charts for popular courses, enrollment, course completion, freemium conversion, and average quiz score.
- Download an analytics summary report.
- Show course-level statistics for enrolled learners, completion, average completion, average learning time, and status distribution.
- Filter course statistics by group, learner search, quiz, or AI mentor lesson.
- Show progress, quiz results, AI mentor results, and learning-time tables in course statistics.
- Restrict analytics and course-statistics views by permissions.

## End-User Value

Learners can understand their own momentum and continue learning from the right place. Administrators can see where learning is working, where learners are stuck, and which courses need attention. Course managers get evidence to support intervention, reporting, and program improvement.

## How It Works

Learners open Progress to view their own statistics. The system aggregates completed and started courses/lessons, quiz performance, activity streaks, and next lesson data for the current user.

Administrators open Analytics to view organization-level charts and download a summary report. From an individual course, permitted users can open the Statistics tab to inspect enrolled learner progress, quiz attempts, AI mentor outcomes, and learning-time data with filters.

Admin statistics are scoped by permission: users with full course-management access can see broad reporting, while own-course managers are limited to their owned course context where applicable.

## Key Technical Context

- Frontend routes include `/progress` and `/admin/analytics`; course statistics are shown inside the course overview Statistics tab.
- API statistics endpoints live under `apps/api/src/statistics`; course-level statistics endpoints live under `apps/api/src/courses`.
- Access includes `STATISTICS_READ` for admin analytics and `COURSE_STATISTICS` for course-level statistics.
- Statistics pull from course progress, lesson progress, quiz attempts, AI mentor progress, learning time, and activity-streak data.
- An analytics integration endpoint under `apps/api/src/analytics` exposes active-user counts behind an analytics secret guard.

## Test Evidence

- Web E2E coverage verifies admin analytics charts, analytics summary report download, role-based course-statistics tab visibility, course statistics overview, progress and quiz-result filters, learning-time table visibility, and AI mentor statistics preview/filter behavior.
- API E2E coverage in the Course controller verifies statistics endpoints exclude deleted students from progress, quiz, average quiz, and learning-time results. No dedicated Statistics controller backend E2E spec was found in the current API test tree.
