# Provider Information Business Spec

## Business Overview

Provider information gives learners and visitors a clear place to see the organization behind the training platform. It stores company identity details such as company name, short name, registered address, tax number, email address, and court register number.

This is useful for compliance, procurement, learner trust, and customer-facing deployments where the training provider must be visible inside the LMS.

## Who Uses It

- Learners viewing the training provider behind their courses.
- Unauthenticated visitors who need access to public company information.
- Administrators maintaining provider identity and compliance information.
- Customer success or operations teams configuring tenant-facing organization details.

## Feature Functions

- Publicly read company/provider information.
- Show a friendly empty state when provider information has not been supplied.
- Allow administrators with settings management access to edit provider information.
- Validate company short name length, tax number format, court register number format, and email format on the frontend.
- Preserve existing fields when an administrator submits a partial update.
- Auto-fill a short company name from the full name when possible.
- Include provider information in the student onboarding tour.

## End-User Value

Learners can identify the provider responsible for the learning environment. Administrators can keep legally relevant provider details current without developer support. Public access also supports externally visible training portals where provider transparency matters before login.

## How It Works

The `/provider-information` route fetches company information through the generated API client and renders either a read-only card or an edit form. The edit button is shown only to users with settings-management access. Submitting changes updates global settings and invalidates the company-information query.

The API exposes a public `GET /api/settings/company-information` endpoint and a permission-protected `PATCH /api/settings/company-information` endpoint. Company information is stored inside global settings. If no company information exists, the service initializes defaults before returning a response.

## Key Technical Context

- Main web implementation: `apps/web/app/modules/ProviderInformation`.
- Main API implementation: `apps/api/src/settings/settings.controller.ts` and `apps/api/src/settings/settings.service.ts`.
- Public route: `/provider-information`.
- Public API read: `GET /api/settings/company-information`.
- Protected API update: `PATCH /api/settings/company-information` with `PERMISSIONS.SETTINGS_MANAGE`.
- Company fields are defined in `apps/api/src/settings/schemas/settings.schema.ts`.

## Test Evidence

- API E2E covers returning existing company information, returning default or empty data, student access, unauthenticated access, admin updates, partial updates preserving fields, missing-record 404 handling, student 403 on update, unauthenticated 401 on update, and invalid-body 400 handling.
- Source-level web evidence covers public rendering, settings-managed edit access, frontend validation, mutation/query invalidation, and onboarding integration.
- I did not find a dedicated provider-information frontend E2E spec.
