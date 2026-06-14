# Organization Settings Business Spec

## Business Overview

Organization Settings let administrators control tenant-wide operational policies. These settings cover authentication requirements, user registration rules, email trigger behavior, MFA enforcement, default course currency, live training capacity, age limits, and login-page support files.

For HR and L&D teams, this area centralizes the policies that affect user onboarding, security posture, payment defaults, and organization-level communication behavior.

## Who Uses It

- HR and L&D administrators who manage registration and communication policies.
- Platform admins who configure security requirements such as SSO and MFA.
- Billing or course admins who need default course currency behavior.
- Support and operations teams who maintain login-page documents and configuration health.

## Feature Functions

- Toggle SSO enforcement when OAuth login is available.
- Enable or disable invite-only registration.
- Toggle user email triggers.
- Enforce MFA by role for admins, students, and content creators.
- Set the default course currency when Stripe is configured.
- Set or clear an organization age limit.
- Configure live training parallel-session limits.
- Upload and manage login-page support files.

## End-User Value

Administrators can adapt the tenant to company policy without code changes. The organization can tighten access rules, control registration availability, manage learner communication, and keep operational settings consistent across the platform.

## How It Works

Users with settings management access open Settings and select the Organization tab. Each setting is presented as a focused card or control. Changes are saved through settings endpoints and reflected in global settings, so affected parts of the app can immediately use the updated policy.

Some controls are shown only when relevant. For example, SSO enforcement appears when OAuth is enabled, and default currency appears when Stripe is configured. Support-mode users do not see personal account settings and are directed toward organization-level context.

## Key Technical Context

- Frontend route: `/settings`; organization controls live in `OrganizationTabContent`.
- API endpoints live under `apps/api/src/settings`.
- Organization updates require settings-management permissions through guarded admin settings endpoints.
- Settings updates record activity-log entries through the settings activity flow.
- Public/global settings are also exposed where unauthenticated screens need tenant behavior such as registration or branding.

## Test Evidence

- Web E2E coverage verifies SSO enforcement persistence, invite-only registration persistence, user email trigger persistence, role-based MFA enforcement, default currency changes with Stripe configured, and age-limit update/clear behavior.
- API E2E coverage verifies global settings retrieval, SSO enforcement updates, permission denial for non-admin users, and related settings update behavior.
