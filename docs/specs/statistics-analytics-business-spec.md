# Statistics And Analytics Business Spec

## Business Overview

Statistics and Analytics give learners, course managers, and administrators visibility into learning progress and program performance. Learners can review their own progress, while administrators can inspect platform-level analytics and course-level learning outcomes.

For HR and L&D teams, this feature supports follow-up, reporting, and program improvement. It helps teams see whether learners are active, whether courses are being completed, how quizzes perform, how AI mentor lessons are used, and how much learning time is being recorded.

The feature has three main surfaces: the learner Progress page, the administrator Analytics dashboard, and course-level Statistics tabs inside course management.

## Who Uses It

- Learners review their own progress, streaks, course completion, lesson completion, and quiz performance.
- Course managers review course-specific learner progress, quiz outcomes, AI mentor outcomes, and learning time.
- Administrators monitor platform-level learning analytics and download summary reports.
- L&D leaders use statistics to identify engagement patterns, stuck learners, and courses that need improvement.

## Feature Functions

- Show learner progress dashboards with activity streaks, quiz score summaries, course rates, and lesson rates.
- Show administrator analytics charts for popular courses, enrollment, course completion, freemium conversion, and average quiz score.
- Download an analytics summary report.
- Show course-level statistics for enrolled learners, completion, average completion, total learning time, and status distribution.
- Filter course statistics by group, learner search, quiz, or AI mentor lesson.
- Show progress, quiz-result, AI mentor, and learning-time tables for a course.
- Exclude deleted learners from course statistics.
- Restrict analytics and course-statistics views by permissions.

## End-User Value

Statistics and Analytics help learning teams move from anecdotal feedback to measurable outcomes. Learners know where they stand, course managers can intervene when learners are stuck, and administrators can track adoption and performance across the platform.

## How It Works

A learner opens Progress to see personal learning activity. Mentingo aggregates the learner's course, lesson, quiz, and streak data in the selected interface language and displays charts that help the learner continue from the right context.

An administrator opens Analytics to review organization-level charts and download a summary report. These charts summarize course popularity, enrollment, completion, freemium conversion, and average quiz performance.

From a course management view, permitted users can open the Statistics tab. Mentingo shows course overview metrics and detailed tables for learner progress, quiz results, AI mentor results, and learning time, with filters for groups, learners, quizzes, and mentor lessons.

## Key Technical Context

- Learner progress is routed at `/progress` and implemented in `apps/web/app/modules/Statistics/Client`.
- Admin analytics is routed at `/admin/analytics` and implemented in `apps/web/app/modules/Statistics/Admin`.
- Learner and admin aggregate endpoints live in `apps/api/src/statistics`; course-level statistics endpoints are in `apps/api/src/courses/course.controller.ts`.
- `STATISTICS_READ` gates admin analytics, and `COURSE_STATISTICS` gates course-level reporting.
- Statistics draw from course progress, lesson progress, quiz attempts, AI mentor progress, learning-time records, and activity streak data.

## Test Evidence

Frontend E2E coverage verifies analytics charts, analytics report download, role-based course-statistics tab visibility, course statistics overview, progress and quiz-result filters, learning-time visibility, and AI mentor statistics preview/filter behavior. API E2E coverage in the Course controller verifies that deleted students are excluded from progress, quiz, average quiz, and learning-time statistics. No dedicated Statistics controller backend E2E spec was found in the discovered API tests.
