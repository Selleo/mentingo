# Learning Paths Business Spec

## Business Overview

Learning paths let L&D teams sequence multiple courses into a development path. A path can be published to learners, enrolled directly or by group, configured for ordered progression, and optionally tied to a learning-path certificate.

For HR and L&D teams, this supports structured development programs such as onboarding, leadership tracks, compliance bundles, or role-based training plans. Instead of assigning standalone courses one by one, admins can manage a program-level learning journey.

The learner workflow starts on the development paths page. Learners browse available paths, enroll when eligible, see the courses inside the path, and progress through them. Admins can create and maintain paths, add courses, manage enrollment, configure sequence/certificate settings, and export paths across tenants where allowed.

## Who Uses It

- Learners browse, enroll in, and complete development paths.
- L&D admins create paths, add courses, and manage enrollments.
- Content creators maintain their own paths when they have own-path permissions.
- Managing tenant admins export paths to other tenants.
- HR and reporting users rely on path progress and certificate outcomes.

## Feature Functions

- Create, update, delete, search, and localize learning paths.
- Add, remove, and reorder courses inside a path.
- Publish paths as draft, private, or published learning journeys.
- Enable sequence mode so courses unlock in order.
- Enroll individual learners or groups into a path.
- Let eligible learners enroll themselves.
- Track path progress as not started, in progress, or completed.
- Issue, render, download, and share learning-path certificates when enabled.
- Export learning paths and linked courses to target tenants.

## End-User Value

Learning paths help organizations manage role-based and program-based training with less manual coordination. Learners get a clear journey, while admins get a higher-level unit for assignment, sequencing, progress, and completion proof.

Group enrollment and export support larger organizations that need repeatable programs across cohorts or tenants.

## How It Works

When learning paths are enabled for the tenant, users with read access can open the development paths page. Learners see path cards and can enroll in eligible paths. Admin-capable users see the management experience, with controls for editing details, managing courses, enrollment, localization, and certificates.

Admins build a path by setting localized title/description, status, thumbnail, certificate options, and sequence behavior. They add courses and order them. Enrollment can be direct or group-based. When course membership, sequence settings, course order, or enrollment changes, the backend syncs the course access each learner should have. In sequence mode, later courses remain locked until prior courses are completed.

When a learner completes all courses in a certificate-enabled path, Mentingo can create a learning-path certificate that can be viewed, downloaded, or shared.

## Key Technical Context

- Learner/admin learning path UI lives under `apps/web/app/modules/LearningPaths` and `apps/web/app/modules/Admin/LearningPaths`.
- The learner-facing route is `/development-paths`; the page renders the admin experience for users with learning-path admin permissions.
- Route access uses `LEARNING_PATH_READ` for learners and learning-path create/update/course/enrollment/export permissions for admins.
- Backend controllers live in `apps/api/src/learning-path/controllers`.
- All learning-path endpoints are protected by `LearningPathsEnabledGuard`.
- Course access and sequence synchronization are handled through learning-path sync services and outbox/queue processing.

## Test Evidence

Backend E2E tests in `apps/api/src/learning-path/__tests__` cover the learning-path feature gate, create/read/update/delete, localization, owner-limited updates, course add/remove/reorder, sequence sync, direct and group enrollment/unenrollment, export to target tenants, export sync behavior, course access retention/removal rules, duplicate sync events, future group members, and certificate rendering/share flows.

No dedicated Playwright learning-path spec was found under `apps/web/e2e/specs` during this pass, so frontend behavior is source-evidenced while backend workflow coverage is strong.
