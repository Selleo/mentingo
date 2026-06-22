# Registration Form Builder Business Spec

## Business Overview

Registration Form Builder lets administrators add organization-specific checkbox acknowledgements to the public registration form. It supports multilingual labels, required checkboxes, display order, and archive/restore behavior.

For HR and L&D teams, this helps collect consent-style confirmations during account creation. Examples include acknowledging platform rules, accepting training policies, confirming data-processing notices, or agreeing to organization-specific onboarding requirements.

The feature connects tenant configuration with the sign-up experience. Administrators maintain active and archived registration fields in Settings, and new users see the localized active fields when creating an account.

## Who Uses It

- HR administrators define required registration acknowledgements for learner onboarding.
- Platform administrators maintain registration requirements as policies change.
- New users complete required checkboxes before creating an account.
- Compliance or operations teams benefit from a consistent sign-up flow for organization-specific confirmations.

## Feature Functions

- Add custom checkbox fields to the registration form.
- Provide localized checkbox labels for supported languages.
- Mark each checkbox as required or optional.
- Reorder fields with drag-and-drop.
- Save new or edited registration fields.
- Archive persisted fields so they no longer appear during sign-up.
- Restore archived fields when an old requirement becomes active again.
- Validate required labels before saving the builder configuration.

## End-User Value

Registration Form Builder lets teams adapt sign-up to their onboarding and compliance needs without custom development. Administrators can add, reorder, retire, and restore acknowledgement fields, while new users see only the active fields relevant to registration.

## How It Works

An administrator opens Settings, switches to platform customization, and uses the Registration Form Builder card. They can add a checkbox, enter localized labels, set whether it is required, reorder the list, and save the configuration.

When a new user opens registration, Mentingo requests the public registration form in the selected interface language. Active fields are rendered as checkboxes, required fields must be selected before submit, and archived fields are excluded from the public sign-up form.

Administrators can still see archived fields in the builder. Archiving a persisted field immediately saves that archived state; restoring it makes the field available again after the builder state is saved.

## Key Technical Context

- The builder UI is `apps/web/app/modules/Dashboard/Settings/components/admin/RegistrationFormBuilder.tsx`, shown in platform customization when the current admin can manage users.
- Public sign-up rendering is in `apps/web/app/modules/Auth/Register.page.tsx`.
- Public registration fields come from `GET /settings/registration-form?language=...`; admin management uses `GET /settings/admin/registration-form` and `PATCH /settings/admin/registration-form`.
- Admin registration-form API endpoints require `PERMISSIONS.SETTINGS_MANAGE`; the Settings UI also hides the builder when user-management access is missing.
- Registration form persistence lives in `apps/api/src/settings/settings.service.ts`, which filters archived fields for public reads and normalizes display order after updates.

## Test Evidence

Frontend Playwright coverage verifies adding and editing checkbox labels, required-state persistence, validation when labels are missing, and archiving/restoring persisted fields. Settings permission-visibility coverage verifies that users without user-management permission do not see the builder. Backend behavior is evidenced through Settings controller/service implementation; no dedicated backend registration-form E2E spec was found in this pass.
