# Course Enrollment Business Spec

## Business Overview

Course enrollment connects learners to the training they need to take. It supports learner self-enrollment for eligible published courses, direct administrator assignment, group-based cohort assignment, unenrollment, and an admin view of who is enrolled.

For HR and L&D teams, enrollment is the operational bridge between a learning catalog and actual participation. It lets teams assign required training to individuals or groups, support voluntary learning where appropriate, and keep course access aligned when teams or cohorts change.

The main admin workflow happens in the enrolled-users tab of a course. Administrators review enrollment status, filter by learner or group, enroll selected users, enroll groups, and remove assignments when training requirements change.

## Who Uses It

- Learners self-enroll in eligible free published courses so they can start training without waiting for manual assignment.
- HR administrators assign required courses to individual employees or groups.
- L&D administrators manage cohort-based training by enrolling and unenrolling groups.
- Course managers review enrollment status before checking progress, due dates, and outcomes.

## Feature Functions

- Let learners self-enroll in eligible published courses.
- Show enrolled and not-yet-enrolled users in the course enrolled-users tab.
- Filter, sort, paginate, and select learners for enrollment actions.
- Enroll selected users directly into a course.
- Enroll groups into a course, including mandatory status and due dates where used.
- Unenroll directly assigned users or enrolled groups.
- Keep learners enrolled when they still have another valid group enrollment path.
- Initialize learner progress when course access is created.

## End-User Value

Enrollment makes learning assignments actionable. Administrators can quickly connect the right people to training, learners can start eligible courses on their own, and group assignment reduces repetitive one-person-at-a-time administration.

Group enrollment also makes recurring HR and L&D workflows easier: onboarding cohorts, department training, compliance refreshes, and time-bound assignments can follow the group structure instead of being rebuilt for every course.

## How It Works

Learners enroll from the course detail experience when the course is published and available to them. Once enrolled, they can begin the course because Mentingo prepares chapter and lesson progress tracking for that learner.

Administrators manage assignment from the course edit screen. The enrolled-users table shows direct enrollment, group enrollment, and not-enrolled states. Admins can select rows for direct enrollment or unenrollment, and they can open group dialogs to add or remove group-based access.

When a group is enrolled, Mentingo links the group to the course and grants access to eligible group members. If a group is later unenrolled, learners are removed only when they do not still qualify through another enrolled group. Mandatory group due dates can also feed calendar and reminder behavior.

## Key Technical Context

- Frontend enrollment management lives in `apps/web/app/modules/Admin/EditCourse/CourseEnrolled`.
- Learner self-enrollment is initiated from the course view.
- API enrollment operations live in `apps/api/src/courses/course.controller.ts`.
- Key permissions include `PERMISSIONS.COURSE_ENROLLMENT` for admin assignment and `PERMISSIONS.LEARNING_PROGRESS_UPDATE` for learner-side progress initialization.
- Group due dates connect enrollment with calendar events and due-date reminders.

## Test Evidence

- Web E2E coverage verifies learner self-enrollment, bulk user enrollment, bulk user unenrollment, enrolled-user filtering by keyword and group, group enrollment, and group unenrollment.
- API E2E coverage verifies enrolled-student listing, direct enrollment permissions and duplicate handling, progress dependency creation, group enrollment metadata, group due-date calendar events, group unenrollment behavior, multi-group fallback, and protection against directly unenrolling group-enrolled learners.
