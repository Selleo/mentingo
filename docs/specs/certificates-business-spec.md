# Certificates Business Spec

## Business Overview

Certificates provide formal recognition for completed courses and learning paths. They help HR and L&D teams document achievement, support compliance evidence, and give learners a portable credential they can download or share externally.

The feature also gives administrators controls for certificate expiration, reset, and validity changes when course requirements change.

## Who Uses It

- Learners who download or share certificates after completing training.
- HR and L&D administrators who manage certificate validity and reset certificates when requirements change.
- Course managers who need to understand the impact of validity updates.
- External viewers who open public certificate share pages or preview images.

## Feature Functions

- List a user’s active certificates on their profile.
- Preview certificates for courses and learning paths.
- Switch certificate preview language between supported certificate languages.
- Download certificate PDFs.
- Create LinkedIn share links and public certificate share pages.
- Generate public certificate preview images.
- Calculate validity impact before changing course certificate rules.
- Reset course certificates for all users, selected groups, or selected users.
- Optionally notify affected users by email when certificates are reset.
- Archive expired or reset certificates while preserving audit activity.

## End-User Value

Learners get visible proof of completed training and can share it beyond the platform. HR and L&D teams get a reliable record of completion while retaining control when certificate rules, course content, or compliance expectations change.

## How It Works

When a learner completes eligible training, the system can create a certificate with course or learning path metadata, validity dates, tenant branding, and visual settings. Users can view certificates from their profile, download a PDF, or create a shareable public link.

Certificate managers can preview how validity changes affect existing certificates. Reset actions archive current certificates, reset relevant progress, and optionally send notifications to affected learners. Reset scope can target all holders, specific groups, or specific users.

Public certificate sharing uses generated share URLs and rendered share images while keeping ownership and tenant access checks in place for protected operations.

## Key Technical Context

- Profile certificate UI lives under the Profile module and renders certificate cards, preview overlays, PDF download, language toggle, and LinkedIn sharing.
- API endpoints are implemented under `apps/api/src/certificates`.
- Core permissions include `CERTIFICATE_READ`, `CERTIFICATE_RENDER`, and `CERTIFICATE_SHARE`; course certificate reset and validity operations require course update permissions.
- Certificate rendering uses tenant branding inputs such as logo, background, signature, and color theme.
- Public share and share-image endpoints are intentionally exposed for external certificate preview flows.

## Test Evidence

- API E2E coverage verifies authenticated certificate listing, archived certificate exclusion, pagination and sorting, single certificate retrieval, PDF download, validity impact, expiration handling, reset by all/users/groups, reset validation, reset options, reset-user search, manager authorization, and activity logging.
- Frontend behavior is evidenced by profile certificate components for listing, preview, download, language toggle, and LinkedIn sharing. No dedicated frontend E2E certificate spec was found in the current test tree.
