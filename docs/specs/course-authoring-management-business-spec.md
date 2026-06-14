# Course Authoring And Management Business Spec

## Business Overview

Course authoring and management let content creators and L&D admins create, configure, publish, maintain, and retire learning products in Mentingo. This feature covers the administrative lifecycle around a course before and after learners see it in the catalog.

For HR and L&D teams, this is the control center for the learning library. It allows the organization to create structured training, localize it, define operational settings, manage pricing or certificates where configured, transfer ownership, and remove draft content safely.

The main workflow starts in the admin course list. An admin creates a course, edits its metadata and settings, builds or manages related tabs, changes status, and later transfers, exports, or deletes the course when needed.

## Who Uses It

- Content creators create and update courses they own.
- L&D admins manage the wider course library and publishing workflow.
- Tenant admins configure course settings, certificates, pricing, sharing, and ownership.
- Managing tenant admins can export eligible master courses to other tenants.

## Feature Functions

- Create standard courses from the admin create page.
- Browse manageable courses from the admin course list.
- Update course title, description, category, thumbnail, and related metadata.
- Change course status, including draft and published states.
- Configure course settings such as certificate behavior and lesson-related options.
- Manage course pricing when Stripe is configured.
- Add, delete, and generate course language variants.
- Transfer course ownership to another eligible user.
- Delete one draft course or bulk delete selected draft courses.
- Export supported courses as SCORM packages or master courses where permissions and configuration allow it.

## End-User Value

This feature gives L&D teams governance over the training catalog. Teams can prepare content privately, publish it when ready, keep ownership accountable, and localize course content for multilingual learners.

Operationally, the feature reduces risk by enforcing permissions, preventing deletion of published courses, and keeping settings such as certificates, pricing, and exports inside the course management workflow.

## How It Works

Admins enter the course management area from `/admin/courses`. Creating a course validates required data and redirects to the edit course screen. The edit screen is tab-based, with status, curriculum, enrollment, pricing, settings, sharing, and other course-type-specific sections shown according to course capabilities and tenant configuration.

Course mutations are permission-gated. Full course admins can update managed courses, while content creators can update their own courses when they have the own-course permission. Language management is handled from the edit screen through available locales and base-language rules.

## Key Technical Context

- Admin course pages live under `apps/web/app/modules/Admin/Courses`, `apps/web/app/modules/Admin/AddCourse`, and `apps/web/app/modules/Admin/EditCourse`.
- Routes include `/admin/courses`, `/admin/beta-courses/new/standard`, and `/admin/beta-courses/:id`.
- Course create, update, settings, language, deletion, SCORM export, master export, and ownership endpoints live in `apps/api/src/courses/course.controller.ts`.
- Key permissions include `COURSE_CREATE`, `COURSE_READ_MANAGEABLE`, `COURSE_UPDATE`, `COURSE_UPDATE_OWN`, `COURSE_DELETE`, and `COURSE_EXPORT`.
- The API enforces ownership-sensitive updates and blocks deletion of published courses.
- The edit UI adapts to course type, enabled integrations, available locales, AI/Luma configuration, Stripe configuration, and managing-tenant status.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/courses` cover creating courses, blocking invalid course data, updating course settings, updating course status, deleting draft courses, bulk deleting draft courses, transferring course ownership, student-mode preview, and course language variants.

Source-level API evidence shows permission checks and service behavior for course creation, updates, settings, language management, deletion, ownership transfer, and export operations. The cited Playwright coverage focuses on the primary admin workflows.
