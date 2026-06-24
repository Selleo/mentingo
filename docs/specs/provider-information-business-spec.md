# Provider Information Business Spec

## Business Overview

Provider Information gives Mentingo tenants a place to display official company or training-provider details. It supports trust, transparency, and compliance by making organization identity information available in the learner-facing product.

The page can show company name, short name, registered address, tax number, email address, and court register number. Authorized administrators can edit these details, while learners and unauthenticated visitors can read the published information.

For HR and L&D, this is useful when training is delivered by an internal academy, external provider, or regulated organization that needs to show clear legal or contact details to learners.

## Who Uses It

- Tenant administrators maintain official company or provider details shown in Mentingo.
- Learners view provider information to understand who operates or delivers the learning platform.
- Public visitors can read provider details when they access the provider-information page without signing in.
- HR and L&D owners use the page to present the organization's identity consistently to learners.

## Feature Functions

- Display provider information in a dedicated learner-facing page.
- Show a clear empty state when provider information has not been filled in.
- Let settings administrators switch into edit mode from the same page.
- Edit company name, short name, registered address, tax number, email address, and court register number.
- Validate short names, email format, and numeric registry/tax fields before saving.
- Auto-fill a short company name from the company name when it is short enough and no short name is provided.
- Preserve existing provider fields during partial updates.
- Include the provider-information page in learner onboarding guidance when the user is eligible for learning-progress updates.

## End-User Value

Provider Information makes the platform feel more transparent and accountable. Learners can see who stands behind the training environment, while administrators can keep legal and contact details up to date without relying on support or engineering changes.

## How It Works

A learner or visitor opens the Provider Information page and sees the currently configured provider details. If no details are configured, Mentingo shows an empty-state message instead of exposing incomplete data.

An administrator with settings-management access can click Edit, update the relevant fields, and save the changes. The form validates important identity fields and supports partial updates so an administrator can change one value without re-entering the full company profile.

When the provider-information page is part of the learner onboarding flow, Mentingo can show a short guided step that introduces the page to eligible learners.

## Key Technical Context

- The page is implemented in `apps/web/app/modules/ProviderInformation/ProviderInformation.page.tsx` with read and edit card components.
- Provider information is read from the public `GET /settings/company-information` endpoint and updated through the protected `PATCH /settings/company-information` endpoint.
- Updates require `PERMISSIONS.SETTINGS_MANAGE`; reads are public and return an empty company-information shape when no values exist.
- The backend validation and persistence live in the Settings domain under `apps/api/src/settings`.
- The onboarding connection uses the shared `OnboardingPages.PROVIDER_INFORMATION` value and only supplies tour steps when the user can update learning progress.

## Test Evidence

Backend E2E coverage verifies public and authenticated reads, empty-state data, admin updates, partial update preservation, 404 behavior when settings are missing, and 403/401/400 responses for unauthorized or invalid updates. The frontend source shows read-only and edit-mode behavior, validation, auto-fill handling, and onboarding integration; no dedicated frontend E2E spec for the provider-information page was found in this pass.
