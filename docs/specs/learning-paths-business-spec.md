# Learning Paths Business Spec

## Business Overview

Learning paths let L&D teams combine multiple courses into a structured development journey. A path can be drafted, published, localized, sequenced, assigned to learners or groups, and optionally connected to a learning-path certificate.

For HR and L&D teams, this supports program-level training such as onboarding, leadership tracks, compliance bundles, and role-based development plans. Instead of assigning standalone courses one by one, administrators can manage the journey as a single learning product.

Learners open the development paths page, browse available paths, enroll when eligible, and progress through the courses inside the path. Administrators create and maintain paths, add courses, manage enrollment, configure sequence and certificate settings, and export paths to other tenants where allowed.

## Who Uses It

- Learners enroll in and complete structured development journeys.
- L&D administrators create paths, add courses, publish programs, and manage learner or group enrollment.
- Content creators maintain their own learning paths when own-path permissions allow it.
- Managing-tenant administrators export reusable paths to target tenants.
- HR and reporting users rely on path progress and certificates as evidence of program completion.

## Feature Functions

- Create, update, delete, search, and localize learning paths.
- Add, remove, and reorder courses inside a path.
- Publish paths as draft, private, or published journeys.
- Enable sequence mode so learners unlock courses in order.
- Enroll individual learners or groups into a path.
- Let eligible learners self-enroll in available paths.
- Track path progress and issue certificates when path certification is enabled.
- Export learning paths and linked courses to other tenants where permitted.

## End-User Value

Learning paths give learners a clear program instead of a loose set of course assignments. Administrators gain a higher-level unit for assignment, sequencing, localization, progress tracking, and completion proof.

Group enrollment, sequence rules, certificates, and export support larger organizations that need repeatable learning programs across cohorts, departments, or tenants.

## How It Works

When learning paths are enabled, learners with access can open `/development-paths` and see path cards in their selected language. If they are eligible, they can enroll and start working through the path's courses.

Administrators use the learning-path management experience to define localized title and description, status, thumbnail, certificate settings, course order, and sequencing. They can enroll selected learners or groups. When the path's courses, enrollment, order, or sequence setting changes, Mentingo synchronizes the course access each enrolled learner should have.

In sequence mode, learners receive access to the next course only after prior course requirements are met. When all required courses are completed and certificates are enabled, Mentingo can create a learning-path certificate that learners can view, download, or share.

## Key Technical Context

- Learner UI lives in `apps/web/app/modules/LearningPaths`; admin UI lives in `apps/web/app/modules/Admin/LearningPaths`.
- Main routes are `/development-paths`, `/admin/development-paths`, `/admin/development-paths/new`, and `/admin/development-paths/:id`.
- Backend controllers live in `apps/api/src/learning-path/controllers`.
- Learning-path endpoints are protected by `LearningPathsEnabledGuard`.
- Key permissions include `PERMISSIONS.LEARNING_PATH_READ`, create/update/delete, course update, enrollment, export, and certificate permissions.
- Course access and sequence synchronization use learning-path sync services and background queue processing.

## Test Evidence

- API E2E coverage verifies the feature gate, create/read/update/delete, localization, own-path permissions, course add/remove/reorder, sequence synchronization, direct and group enrollment/unenrollment, export behavior, course access retention/removal rules, duplicate sync handling, future group members, and learning-path certificate rendering/share flows.
- I did not find a dedicated Playwright learning-path spec under `apps/web/e2e/specs`; frontend behavior is supported by source evidence and strong backend workflow coverage.
