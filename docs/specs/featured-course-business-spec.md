# Featured Course Business Spec

## Business Overview

Featured courses give administrators a simple way to place one published course at the front of the modern learner course experience. This helps HR and L&D teams direct attention to priority onboarding, compliance, or campaign training without changing the course's normal enrollment or access rules.

An administrator selects a published course from the course header, and Mentingo presents it as the hero course for learners who can access it. The administrator can replace the selection or clear it when the promotion ends.

## Who Uses It

- Administrators highlight a priority published course so learners notice the training that matters most right now.
- Learners see the organization's selected course prominently in the modern course experience and can open it through the existing course access flow.

## Feature Functions

- Select one published course as the featured course.
- Search and load more published courses while choosing the featured course.
- Display the selected course as the modern course experience's hero course.
- Replace the featured course with another published course.
- Clear the featured course when no course should be promoted.
- Remove stale featured references when the selected course is unpublished, deleted, or replaced by a bulk status change.

## End-User Value

Organizations can focus learner attention on timely training without duplicating content or changing enrollment setup. Learners get a clear starting point for priority learning while the existing course permissions and availability remain in force.

## How It Works

An administrator with settings-management access opens the modern course list and uses the featured-course control in the header. The selector searches published courses in the active content language and supports pagination. After selection, the course appears in the hero area for learners who are eligible to see it. The administrator can clear or change the selection at any time.

Mentingo accepts only published courses for a new selection. If the selected course later becomes unavailable through an individual or bulk status update, or is deleted, the global featured selection is cleared so the learner experience does not point at stale content. The selection is tenant-scoped and does not grant access to the course by itself.

## Key Technical Context

- The administrator control is `apps/web/app/modules/Courses/components/modern/FeaturedCourseSelect.tsx`; the hero consumes the setting in `ModernCoursesView.tsx`.
- The API exposes a permission-protected global featured-course update and a published-course lookup under `apps/api/src/settings/settings.controller.ts` and `apps/api/src/courses/course.controller.ts`.
- `PERMISSIONS.SETTINGS_MANAGE` controls selection; course visibility and access remain enforced by the existing course APIs.
- The setting is stored in tenant global settings and is cleared by course status, bulk status, and deletion flows.

## Test Evidence

API E2E coverage verifies selecting and clearing a published course, rejecting invalid or unauthorized selections, and clearing the reference when a course is unpublished, bulk-unpublished, or deleted. The frontend implementation provides stable selectors and localized controls for the selection workflow; a dedicated Playwright flow for featured-course selection was not identified.
