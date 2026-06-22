# Organization Settings Business Spec

## Business Overview

Organization Settings give tenant administrators a central place to control platform-wide policies that affect access, security, communication, learner eligibility, and operational limits. These settings let HR, L&D, and platform administrators adapt Mentingo to the organization's governance model without changing product code.

The feature covers decisions such as whether users must sign in through SSO, whether registration is invite-only, which system email triggers are enabled, which roles must use MFA, what default course currency should be used, whether age limits apply, how many live trainings may run in parallel, and which supporting files should appear on the login page.

For HR and L&D, this matters because learning programs often need to follow company security rules, onboarding policies, commercial configuration, and employee eligibility constraints. Organization Settings make those controls visible and maintainable by authorized administrators.

## Who Uses It

- Tenant administrators configure organization-wide authentication, registration, security, and learner eligibility rules.
- HR and L&D operations owners manage communication triggers and login-page support materials that affect learner onboarding.
- Learning operations teams set live-training capacity rules and default course currency when those features are enabled.
- Support-mode users are directed to the organization area when their access is focused on tenant configuration rather than personal account settings.

## Feature Functions

- Enforce SSO sign-in when an OAuth provider is enabled for the tenant.
- Require invite-only registration when open self-registration should be disabled.
- Enable or disable user email triggers used by operational learning workflows.
- Require MFA for selected roles.
- Set the default course currency when Stripe-based course pricing is configured.
- Set, change, or clear the tenant age limit.
- Define the maximum number of live trainings that may run in parallel.
- Upload, preview, and remove login-page support documents with administrator-provided display names.

## End-User Value

Organization Settings help administrators keep Mentingo aligned with company policy and learner-program operations. Learners experience the right access rules, security expectations, and onboarding materials, while administrators gain a single control point for settings that would otherwise require support or engineering work.

## How It Works

An administrator opens Settings and uses the Organization tab to review configuration status and adjust tenant-wide controls. Mentingo shows controls that are relevant to the current tenant setup, such as SSO enforcement only when supported OAuth login is enabled and default currency only when Stripe is configured.

Changes are saved through dedicated settings controls and immediately affect the tenant's platform behavior. Login-page documents can be added with a display name, previewed, and removed; these files are available publicly on the login page so unauthenticated learners or visitors can access the organization's supporting materials.

Users without settings-management access do not see administrator organization controls. The Settings navigation also adapts by showing only the tabs and cards the current user's permissions allow.

## Key Technical Context

- The Organization tab is assembled in `apps/web/app/modules/Dashboard/Settings/components/admin/OrganizationTabContent.tsx`.
- Organization settings are handled by `apps/api/src/settings/settings.controller.ts` and the settings service, with public global settings used where unauthenticated pages need tenant configuration.
- Administrative changes require `PERMISSIONS.SETTINGS_MANAGE`.
- Settings behavior is tenant-scoped and stored in global tenant settings rather than per-user settings.
- Login-page documents use the Settings login-page files endpoints and existing file validation for supported document types.

## Test Evidence

Frontend Playwright coverage verifies SSO enforcement, invite-only registration, user email trigger persistence, role-based MFA, default currency, age-limit updates, settings navigation/access rules, and login-page file upload, validation, preview, deletion, and max-file behavior. Backend E2E coverage verifies global settings reads and updates, permission denials, SSO, learning-path/course-discussion/calendar/live-training settings, and login-page file access rules.
