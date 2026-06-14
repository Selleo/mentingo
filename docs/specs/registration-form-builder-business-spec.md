# Registration Form Builder Business Spec

## Business Overview

Registration Form Builder lets administrators add custom checkbox fields to the registration process. It supports multilingual labels, required fields, display order, and archive/restore behavior.

For HR and L&D teams, this helps capture explicit acknowledgements during account creation, such as policy consent, terms confirmation, data-processing acknowledgement, or organization-specific registration requirements.

## Who Uses It

- HR administrators who define registration requirements.
- Platform administrators who manage tenant onboarding controls.
- New users who answer custom registration fields during sign-up.
- Auditors who need consistent consent-style registration inputs.

## Feature Functions

- Add custom checkbox fields to the registration form.
- Provide localized labels for supported languages.
- Mark a field as required or optional.
- Reorder fields with drag-and-drop.
- Save new and edited fields.
- Archive persisted fields without deleting their history.
- Restore archived fields.
- Hide the builder from users without user-management permission.

## End-User Value

Administrators can tailor registration to organizational needs without custom development. Required checkboxes help ensure important acknowledgements are collected before account creation, while archived fields let teams retire old requirements without losing administrative control.

## How It Works

Administrators open Platform Customization in Settings and use the Registration Form Builder card. They add checkbox fields, edit labels by language, set required status, reorder fields, and save the configuration.

The public registration form requests the localized active fields for the user’s language. Archived fields remain visible to administrators but are not returned in the public localized form.

## Key Technical Context

- Builder UI lives in `RegistrationFormBuilder` under Settings platform customization.
- Public registration fields are served by `GET /api/settings/registration-form?language=...`.
- Admin management uses `GET /api/settings/admin/registration-form` and `PATCH /api/settings/admin/registration-form`.
- Supported registration field type is currently checkbox.
- Shared constants define registration form and field types in `packages/shared/src/constants/registrationForm.ts`.

## Test Evidence

- Web E2E coverage verifies adding/editing checkbox labels and required state, validation when labels are missing, and archiving/restoring persisted fields.
- Settings permission-visibility E2E coverage verifies users without user-management permission do not see the registration form builder.
- API schema and service evidence confirm localized public fields, admin inclusion of archived fields, and display-order normalization.
