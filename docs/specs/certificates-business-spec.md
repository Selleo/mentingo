# Certificates Business Spec

## Business Overview

Certificates provide formal proof that a learner completed a course or learning path. They support HR and L&D needs around recognition, compliance evidence, auditability, and external sharing of learning achievements.

The feature also gives course managers controlled ways to handle certificate validity and resets when course requirements change. Existing certificates can remain valid for historical record, receive updated validity rules, expire automatically, or be reset when the organization needs learners to re-complete training.

## Who Uses It

- Learners viewing, downloading, or sharing certificates from their profile.
- HR and L&D administrators reviewing learner certificate records.
- Course administrators managing certificate availability, validity, and resets for courses they can update.
- External viewers opening public certificate share pages created by learners.

## Feature Functions

- List active certificates for a learner profile.
- Open certificate previews for completed courses and learning paths.
- Switch certificate preview language between all supported platform languages.
- Download certificate PDFs with generated filenames.
- Share certificates externally through LinkedIn/public share links.
- Configure whether a course issues certificates.
- Set certificate validity rules for a course.
- Show the impact of validity changes before applying them to active certificates.
- Reset course certificates for all holders, selected groups, or selected users.
- Optionally notify affected learners when certificates are reset.
- Archive expired or reset certificates while preserving activity history.

## End-User Value

Learners receive portable proof of completion that they can keep, download, and share outside Mentingo. HR and L&D teams get a reliable record of achievement for audits, compliance programs, and internal mobility.

For administrators, the reset and validity tools reduce operational risk. When a course changes materially, the team can identify affected certificate holders, choose the right reset scope, and keep historical certificate activity instead of silently overwriting records.

## How It Works

Learners access certificates from the profile certificate area. Each certificate can be previewed, rendered as a PDF, and shared when sharing is enabled. Certificate rendering is available in every supported platform language, including Spanish, even when the related course or learning path does not have a translation in that language; in that case Mentingo falls back to the base title. Public share endpoints serve external certificate pages and images, while protected certificate listing, rendering, and share-link creation remain permission-gated.

Course certificate settings are managed from the admin course settings workflow. Administrators can enable certificate issuance, define validity, inspect how a validity change affects active certificates, and choose whether the change applies only to future certificates or also to existing active certificates.

Certificate reset actions archive matching active certificates, reset the relevant learner progress, record certificate activity, and optionally send reset emails. Reset scope can target all certificate holders for the course, selected groups, or selected users with active certificates.

## Key Technical Context

- Profile certificate UI lives under `apps/web/app/modules/Profile/Certificates`.
- Course certificate settings and reset UI live under `apps/web/app/modules/Admin/EditCourse/CourseSettings`.
- API endpoints are implemented under `apps/api/src/certificates`.
- Core permissions include `PERMISSIONS.CERTIFICATE_READ`, `PERMISSIONS.CERTIFICATE_RENDER`, and `PERMISSIONS.CERTIFICATE_SHARE`.
- Course certificate validity and reset operations require `PERMISSIONS.COURSE_UPDATE` or `PERMISSIONS.COURSE_UPDATE_OWN`.
- Public share endpoints intentionally allow external certificate page and image access for share workflows.
- Certificate PDFs, previews, share pages, and share images use the shared supported-language list, so new platform languages become available to certificates through the same contract.

## Test Evidence

- API E2E coverage verifies authenticated certificate listing, archived certificate exclusion, pagination and sorting, single certificate retrieval, PDF downloads, custom download filenames, validity-impact counts, bulk validity application, expiration handling, reset by all/users/groups, reset validation, reset options, reset-user search, authorization, and activity logging.
- Frontend unit/source evidence covers profile certificate cards, previews, downloads, language toggles, LinkedIn sharing controls, certificate theme behavior, course certificate settings, validity-impact confirmation, and reset dialogs.
- I did not find a dedicated frontend E2E certificate spec in the current test tree.
