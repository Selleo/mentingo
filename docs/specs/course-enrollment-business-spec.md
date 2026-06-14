# Course Enrollment Business Spec

## Business Overview

Course enrollment connects learners to courses. It supports self-enrollment by learners, direct user enrollment by admins, group-based enrollment for cohorts, unenrollment, and visibility into who is enrolled in a course.

For HR and L&D teams, enrollment is the operational bridge between a learning catalog and actual learner assignment. It lets admins target courses to individuals or organizational groups, while also allowing learners to join eligible published courses themselves.

The main admin workflow happens in the enrolled-users tab of a course. Admins review enrolled learners, filter the list, add users, enroll groups, and remove direct or group enrollments when assignments change.

## Who Uses It

- Learners self-enroll in eligible free published courses.
- HR admins assign courses to specific employees or groups.
- L&D admins manage cohort-based training assignments.
- Course managers review enrollment status before tracking progress and outcomes.

## Feature Functions

- Let learners self-enroll in eligible courses from the course detail page.
- Bulk enroll selected users into a course.
- List enrolled users with pagination, search, sorting, and group visibility.
- Bulk unenroll directly enrolled users.
- Enroll one or more groups into a course.
- Set group enrollment metadata such as mandatory status and due date where the group enrollment flow provides it.
- Unenroll groups from a course and update affected learner enrollments.
- Create learner progress dependencies when enrollment is created.

## End-User Value

Enrollment makes learning assignments actionable. Admins can quickly connect the right people to required training, learners gain access without waiting for manual setup when self-enrollment is allowed, and group assignment keeps cohort management consistent as teams grow.

Due-date handling for group enrollment also helps HR and L&D teams turn course access into time-bound learning expectations.

## How It Works

Learners enroll from the course detail page. The enrollment action creates a student-course record and initializes chapter and lesson progress records so the learner can begin training immediately.

Admins manage enrollments from the course edit screen. They can add selected users, enroll groups, or remove users and groups. Group enrollment attaches eligible group members to the course, excludes course authors/managers where appropriate, and can create or cancel due-date calendar events. Unenrolling a group removes that group-course relationship and updates learner enrollment state only when the learner is not still enrolled through another group.

## Key Technical Context

- Frontend enrollment management lives in `apps/web/app/modules/Admin/EditCourse/CourseEnrolled`.
- Learner self-enrollment is initiated from `apps/web/app/modules/Courses/CourseView/CourseOptions.tsx`.
- API enrollment endpoints live in `apps/api/src/courses/course.controller.ts`, including `enroll-course`, `:courseId/enroll-courses`, `:courseId/enroll-groups-to-course`, `:courseId/unenroll-groups-from-course`, and `unenroll-course`.
- Main service logic is in `apps/api/src/courses/course.service.ts`, especially `enrollCourse`, `enrollCourses`, `enrollGroupsToCourse`, `unenrollGroupsFromCourse`, `createStudentCourse`, and `createCourseDependencies`.
- Key permissions include `COURSE_ENROLLMENT` for admin assignment and `LEARNING_PROGRESS_UPDATE` for learner-side enrollment/progress access.
- Enrollment publishes assignment/enrollment events and initializes learner progress records for chapters and lessons.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/course-enrollment` cover learner self-enrollment, bulk user enrollment, bulk user unenrollment, enrolled-user listing with keyword and group filters, group enrollment, and group unenrollment.

Source evidence also shows backend safeguards for duplicate enrollment, deleted users, author self-enrollment restrictions, users already enrolled by group, course existence, group existence, progress initialization, and due-date calendar updates.
