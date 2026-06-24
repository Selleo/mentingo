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

## Feature Functions

- Let users sign in with email and password when password login is allowed.
- Let visitors register new accounts when SSO enforcement and invite-only registration do not block self-registration.
- Let invited users create a password from an email link.
- Let users request password recovery emails and set a new password from a reset link.
- Let users request and consume magic-link emails for passwordless login.
- Require MFA verification when a user's settings or role policy require it.
- Support Google, Microsoft, and Slack OAuth entry points when configured.
- Refresh sessions with refresh tokens and clear session cookies on logout.

## End-User Value

The feature gives learners and staff multiple safe ways to reach the platform without turning account access into an HR support queue. Password recovery, invite links, and magic links help users unblock themselves, while MFA and SSO support stronger controls for organizations that need them.

Because current-user responses include permissions and onboarding state, Mentingo can send users to the right experience after login and protect management areas from users who should not access them.

## How It Works

A user chooses the appropriate auth path from the login area. For email/password login, Mentingo validates credentials, checks archived status, applies login rate limiting, and decides whether MFA is still required. If MFA is required, the user receives temporary auth cookies and must complete the MFA page before entering the app.

For registration, Mentingo checks tenant settings first. If SSO is enforced or registration is invite-only, self-registration is blocked. Otherwise, the registration flow validates identity fields, password rules, language, and tenant registration-form answers before creating the account and signing the user in.

For recovery and passwordless flows, Mentingo sends tenant-aware email links. Reset and magic-link tokens are stored as hashes, expire, and are consumed when used. OAuth callbacks create normal Mentingo sessions after provider authentication succeeds. Logout clears cookies and records the user activity through events.

## Key Technical Context

- Frontend auth pages live in `apps/web/app/modules/Auth` under `/auth/*`.
- API behavior is centered in `apps/api/src/auth/auth.controller.ts` and `apps/api/src/auth/auth.service.ts`.
- MFA routing is enforced in `apps/web/app/Guards/MFAGuard.tsx`; route permissions are enforced separately by `RouteGuard`.
- Session handling uses access and refresh token cookies through the auth/token service flow.
- Tenant settings influence SSO enforcement, invite-only registration, MFA-enforced roles, login assets, and registration form requirements.
- User password status and password changes are covered through user endpoints in `apps/api/src/user`.

## Test Evidence

Web E2E tests cover sign-in/sign-out, auth-page navigation, invalid credentials, public registration validation, invite password creation, password recovery, magic-link login, and MFA setup/verification.

Backend E2E tests cover registration validation, duplicate accounts, language behavior, registration checkbox answers, login cookies, invalid credentials, login rate limiting, logout cookie clearing, refresh tokens, current-user data, password reset, create-password flows, magic-link token hashing and consumption, and MFA issuer behavior.

OAuth provider callbacks and support-mode auth are visible in source, but the cited E2E coverage is strongest for password, invite, recovery, magic-link, session, and MFA flows.
