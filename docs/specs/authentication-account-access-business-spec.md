# Authentication and Account Access Business Spec

## Business Overview

Authentication and Account Access control how people enter Mentingo and how the app keeps that access secure after login. The feature covers email/password sign-in, public registration when allowed, invite-based password creation, password recovery, magic-link login, MFA, OAuth/SSO entry points, token refresh, current-user resolution, and logout.

For HR and L&D teams, reliable access is the start of every learning workflow. Learners need a low-friction way back into training, administrators need stronger controls for management accounts, and tenant operators need settings that match company security expectations.

The main workflow begins on the auth pages. A visitor signs in, registers, follows an invite, requests a reset link, uses a magic link, or completes MFA. After successful authentication, Mentingo sets session cookies, resolves the user's permissions and onboarding state, and routes them into the app.

## Who Uses It

- Learners register when self-registration is open, sign in to continue courses, recover passwords, or use magic-link access when they cannot use a password.
- Invited employees create their first password from an invitation email and then enter the course area.
- HR and L&D administrators sign in to manage users, courses, reporting, announcements, and tenant learning operations.
- Tenant administrators use MFA, SSO enforcement, invite-only registration, registration forms, and login branding settings to match company access policy.
- Organization administrators choose which login methods employees see, for example turning off passwords so everyone signs in with Microsoft or a magic link.

## Feature Functions

- Let users sign in with email and password when password login is allowed.
- Let visitors register new accounts when SSO enforcement and invite-only registration do not block self-registration.
- Let invited users create a password from an email link.
- Let users request password recovery emails and set a new password from a reset link.
- Require users with a temporary password to replace it before they can use the platform.
- Let users request and consume magic-link emails for passwordless login.
- Require MFA verification when a user's settings or role policy require it.
- Support Google, Microsoft, and Slack OAuth entry points when configured.
- Refresh sessions with refresh tokens and clear session cookies on logout.
- Let organization administrators turn password, magic-link, Google, Microsoft, and Slack login on or off, with a shortcut to the right environment settings section when a provider still needs credentials.

## End-User Value

The feature gives learners and staff multiple safe ways to reach the platform without turning account access into an HR support queue. Password recovery, invite links, and magic links help users unblock themselves, while MFA and SSO support stronger controls for organizations that need them.

Because current-user responses include permissions and onboarding state, Mentingo can send users to the right experience after login and protect management areas from users who should not access them.

## How It Works

A user chooses the appropriate auth path from the login area. For email/password login, Mentingo validates credentials, checks archived status, applies login rate limiting, and decides whether MFA is still required. If MFA is required, the user receives temporary auth cookies and must complete the MFA page before entering the app.

For registration, Mentingo checks tenant settings first. If registration is invite-only, the registration page explains that an invitation is required and offers a link to sign in. If SSO is enforced or registration is invite-only, the API blocks self-registration. Otherwise, the registration flow validates identity fields, password rules, language, and tenant registration-form answers before creating the account and signing the user in.

For recovery and passwordless flows, Mentingo sends tenant-aware email links. Reset and magic-link tokens are stored as hashes, expire, and are consumed when used. A magic-link request expires from the time it was made; if the account email changes, a pending link is not sent to the former address and an already issued automation link cannot be used. OAuth callbacks create normal Mentingo sessions after provider authentication succeeds. Logout clears cookies and records the user activity through events.

Organization administrators manage login methods from the Organization tab in Settings. Each method has its own switch. A provider that still needs a client ID or secret can't be switched on; hovering its switch explains that all required environment variables must be added first, and a "Go to configuration" button sits beside it. The button opens that provider's highlighted section of the environment settings page. A provider that is already on can always be switched off. The public login page shows only the enabled methods. Turning off password login hides the password form, registration link, and "or continue with" separator, and the API also rejects password sign-in, registration, password creation, and password recovery. Turning off magic links hides the magic-link button and blocks requesting or using links, including ones already issued. Mentingo refuses to turn off the last method that still works. Providers without credentials don't count as working, and neither does password login while SSO is enforced. Simultaneous changes by two administrators are handled one at a time, so they can't lock everyone out together.

When an organization provides an account with a temporary password, Mentingo takes the user to a dedicated password-change screen after sign-in and MFA. The rest of the platform remains unavailable until the user saves a compliant replacement password or logs out. A password reset also fulfils this requirement, so users can recover safely without administrator intervention.

## Key Technical Context

- Frontend auth pages live in `apps/web/app/modules/Auth` under `/auth/*`.
- API behavior is centered in `apps/api/src/auth/auth.controller.ts` and `apps/api/src/auth/auth.service.ts`.
- MFA routing is enforced in `apps/web/app/Guards/MFAGuard.tsx`; route permissions are enforced separately by `RouteGuard`.
- Session handling uses access and refresh token cookies through the auth/token service flow.
- Tenant settings influence SSO enforcement, invite-only registration, MFA-enforced roles, login assets, and registration form requirements.
- User password status and password changes are covered through user endpoints in `apps/api/src/user`.
- Login methods are managed through `apps/api/src/env/services/login-methods.service.ts` and the Organization settings tab. Changing them requires env-management permission. The list of enabled methods is public, so the login page can render without a session. All login switches, including the provider enable flags previously edited as environment values, can only be changed through this flow, not through generic secret updates. The configuration status checks each provider only for its client ID and secret; Microsoft Calendar is reported separately.
- Password credentials can require a change; API enforcement blocks normal authenticated operations and the frontend uses the MFA guard pattern to keep the user on `/auth/change-password` until completion.

## Test Evidence

Web E2E tests cover sign-in/sign-out, auth-page navigation, invalid credentials, public registration validation, the invite-only registration explanation and login link, invite password creation, password recovery, magic-link login, and MFA setup/verification.

Backend E2E tests cover registration validation, duplicate accounts, language behavior, registration checkbox answers, login cookies, invalid credentials, login rate limiting, logout cookie clearing, refresh tokens, current-user data, password reset, create-password flows, magic-link token hashing and consumption, and MFA issuer behavior.

Focused API service tests cover expiry from the original request time and cancellation when the account or queued recipient email changes. A backend E2E regression covers rejection of an automation-issued link after an account email change; it has not been run against the shared development database.

Login-method configuration is covered by backend E2E tests in `apps/api/src/env/__tests__/login-methods.e2e-spec.ts`. They check the default methods, that secrets never appear in responses, missing-credential reporting, configuration status per provider, permission checks, rejection of providers without credentials, refusal to write login switches through generic secret updates, the last-usable-method safeguard (including unconfigured providers and SSO enforcement), serialization of concurrent updates, and rejection of every password and magic-link flow when that method is disabled. Web E2E specs check that disabling password login persists and removes the password form from the public login page, and that the Google button follows the Google login switch.

Password-change enforcement is covered by API E2E assertions that a flagged user cannot use normal protected endpoints, can change their own password, and regains access after the change.

OAuth provider callbacks and support-mode auth are visible in source, but the cited E2E coverage is strongest for password, invite, recovery, magic-link, session, and MFA flows.
