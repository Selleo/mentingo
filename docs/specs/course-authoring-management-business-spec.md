# Course Authoring And Management Business Spec

## Business Overview

Course authoring and management is the administrative lifecycle for Mentingo courses. It lets L&D teams create courses, maintain metadata, prepare content privately, publish training when ready, localize it for supported languages, manage operational settings, and retire draft material safely.

For HR and L&D teams, this is the control center for the learning catalog. It keeps course ownership, status, settings, pricing, certificates, enrollment, language variants, and export actions inside one governed workflow.

## Who Uses It

- Content creators creating and maintaining courses they own.
- L&D administrators managing the broader course catalog and publication flow.
- Course administrators configuring settings, certificates, pricing, language variants, enrollment, and ownership.
- Managing-tenant administrators exporting eligible master courses to other tenants.

## Feature Functions

- Create standard courses from the admin create workflow.
- Choose supported course types where the tenant configuration allows them.
- Browse, filter, and open manageable courses from the admin course list.
- Update course title, description, category, thumbnail, and related metadata.
- Change course category and status individually or in bulk, including draft, private, and published states.
- Configure course settings such as certificate behavior and lesson sequencing options.
- Manage course pricing when Stripe pricing is configured.
- Add, edit, delete, and generate course language variants.
- Manage course enrollment for users and groups from the course edit area.
- Transfer course ownership to another eligible user.
- Delete draft courses individually or in bulk.
- Export supported courses as SCORM packages or master-course exports when permissions and configuration allow it.

## End-User Value

The feature gives L&D teams governance over the training library. Teams can prepare courses before learners see them, publish only when content is ready, keep accountability through ownership, and maintain multilingual versions for different learner populations.

Operational controls reduce mistakes. Permissions distinguish full course management from own-course editing, published courses are protected from draft-delete flows, and optional capabilities such as pricing, certificates, SCORM, and master exports appear only when the course and tenant support them.

## How It Works

Administrators start in the admin course list and open a course edit screen or create a new course. Course creation validates required metadata, then sends the user into the edit workflow where tabs expose the relevant management areas for that course.

The edit experience adapts to course type, tenant configuration, integrations, available languages, and permissions. For example, pricing depends on Stripe configuration, AI/Luma-related tools depend on their configuration, SCORM courses hide unsupported admin features, and managing-tenant exports are shown only to eligible users.

Course mutations are permission-gated. Full course administrators can manage courses according to their permissions, while content creators rely on own-course update permissions for courses they own. In the admin course list, permitted users can select multiple courses and use the bulk-edit menu to change their category, change their status, or delete draft courses in one governed workflow. Language operations respect supported-language and base-language rules.

## Key Technical Context

- Admin course pages live under `apps/web/app/modules/Admin/Courses`, `apps/web/app/modules/Admin/AddCourse`, and `apps/web/app/modules/Admin/EditCourse`.
- Main routes include `/admin/courses`, `/admin/beta-courses/new/standard`, and `/admin/beta-courses/:id`.
- Course create, update, bulk category update, bulk status update, settings, language, deletion, SCORM export, master export, enrollment, and ownership endpoints live in `apps/api/src/courses/course.controller.ts`.
- Key permissions include `PERMISSIONS.COURSE_CREATE`, `PERMISSIONS.COURSE_READ_MANAGEABLE`, `PERMISSIONS.COURSE_UPDATE`, `PERMISSIONS.COURSE_UPDATE_OWN`, `PERMISSIONS.COURSE_DELETE`, `PERMISSIONS.COURSE_ENROLLMENT`, and `PERMISSIONS.COURSE_EXPORT`.
- The edit UI adapts to course type, enabled integrations, available locales, Stripe configuration, AI/Luma configuration, and managing-tenant status.

## Test Evidence

- Web E2E coverage verifies course creation, invalid create-form validation, course list browsing/filtering, opening the create page, updating settings, updating status, bulk category updates, bulk status updates, deleting draft courses, bulk deleting draft courses, transferring ownership, student-mode preview, course pricing, course language variants, SCORM course creation/import behavior, unsupported SCORM feature hiding, and SCORM export flows.
- Source-level API evidence covers permission checks and service paths for course creation, updates, bulk category updates, bulk status updates, settings, language management, enrollment, deletion, ownership transfer, and export operations.
