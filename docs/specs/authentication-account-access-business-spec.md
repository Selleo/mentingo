# Authentication and Account Access Business Spec

## Business Overview

Authentication and Account Access control how people enter Mentingo and how the app keeps that access secure after login. The feature covers email/password sign-in, phone-number sign-in with a one-time SMS code (when enabled for the deployment), public registration when allowed, invite-based password creation, password recovery, magic-link login, MFA, OAuth/SSO entry points, token refresh, current-user resolution, and logout.

For HR and L&D teams, reliable access is the start of every learning workflow. Learners need a low-friction way back into training, administrators need stronger controls for management accounts, and tenant operators need settings that match company security expectations.

The main workflow begins on the auth pages. A visitor signs in with email or phone, registers, follows an invite, requests a reset link, uses a magic link, or completes MFA. After successful authentication, Mentingo sets session cookies, resolves the user's permissions and onboarding state, and routes them into the app.

## Who Uses It

- Learners register when self-registration is open, sign in to continue courses, recover passwords, or use magic-link access when they cannot use a password.
- Invited employees create their first password from an invitation email and then enter the course area.
- Learners who rarely use email (for example, students of a school where parents or learners mostly use phones) sign in with their phone number and a code from an SMS, after an administrator or the learner has linked that number to their account.
- HR and L&D administrators sign in to manage users, courses, reporting, announcements, and tenant learning operations.
- Tenant administrators use MFA, SSO enforcement, invite-only registration, registration forms, and login branding settings to match company access policy.

## Feature Functions

- Let users sign in with email and password when password login is allowed.
- Let visitors register new accounts when SSO enforcement and invite-only registration do not block self-registration.
- Let invited users create a password from an email link.
- Let users request password recovery emails and set a new password from a reset link.
- Require users with a temporary password to replace it before they can use the platform.
- Let users sign in with their phone number and a 6-digit SMS code instead of a password.
- Let users add, change, or remove the phone number on their account after confirming it with an SMS code, and let administrators set or clear a user's phone number.
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

For phone sign-in, the user switches the login form to the phone tab, enters their number, and receives a 6-digit code by SMS. Entering the code signs them in with the same session and MFA rules as email login. Only existing, active accounts that already have that number can sign in this way; the login page always shows the same "code sent if the number is registered" message so it cannot be used to discover who has an account. Codes expire after five minutes, allow a limited number of attempts, and can be re-sent only after a short countdown. Learners confirm a new number from their account settings with the same kind of code; numbers entered by administrators become confirmed on the user's first successful SMS sign-in. A phone number can belong to only one user in an organization.

For recovery and passwordless flows, Mentingo sends tenant-aware email links. Reset and magic-link tokens are stored as hashes, expire, and are consumed when used. OAuth callbacks create normal Mentingo sessions after provider authentication succeeds. Logout clears cookies and records the user activity through events.

When an organization provides an account with a temporary password, Mentingo takes the user to a dedicated password-change screen after sign-in and MFA. The rest of the platform remains unavailable until the user saves a compliant replacement password or logs out. A password reset also fulfils this requirement, so users can recover safely without administrator intervention.

## Key Technical Context

- Frontend auth pages live in `apps/web/app/modules/Auth` under `/auth/*`.
- API behavior is centered in `apps/api/src/auth/auth.controller.ts` and `apps/api/src/auth/auth.service.ts`.
- MFA routing is enforced in `apps/web/app/Guards/MFAGuard.tsx`; route permissions are enforced separately by `RouteGuard`.
- Session handling uses access and refresh token cookies through the auth/token service flow.
- Tenant settings influence SSO enforcement, invite-only registration, MFA-enforced roles, login assets, and registration form requirements.
- User password status and password changes are covered through user endpoints in `apps/api/src/user`.
- Phone sign-in is switched on per deployment with `PHONE_AUTH_ENABLED` and sends SMS through SMS.RU (`apps/api/src/phone-auth`); the web app hides all phone UI when `GET /api/auth/phone/config` reports it disabled. One-time codes are stored only as HMAC hashes in Redis, and numbers are normalized to international format (Russia, Kazakhstan, Mongolia).
- Password credentials can require a change; API enforcement blocks normal authenticated operations and the frontend uses the MFA guard pattern to keep the user on `/auth/change-password` until completion.

## Test Evidence

Web E2E tests cover sign-in/sign-out, auth-page navigation, invalid credentials, public registration validation, invite password creation, password recovery, magic-link login, and MFA setup/verification.

Backend E2E tests cover registration validation, duplicate accounts, language behavior, registration checkbox answers, login cookies, invalid credentials, login rate limiting, logout cookie clearing, refresh tokens, current-user data, password reset, create-password flows, magic-link token hashing and consumption, and MFA issuer behavior.

Phone sign-in is covered by backend E2E tests (`apps/api/src/phone-auth/__tests__/phone-auth.e2e-spec.ts`) for code delivery, identical responses for unknown numbers, resend cooldown, per-IP limits, single-use codes, attempt limits, MFA hand-off, attaching a number with verification, per-organization uniqueness, and admin phone edits; unit tests cover number normalization, the OTP store, and SMS.RU responses. The phone login form has a component test; there is no web E2E test for phone sign-in yet.

Password-change enforcement is covered by API E2E assertions that a flagged user cannot use normal protected endpoints, can change their own password, and regains access after the change.

OAuth provider callbacks and support-mode auth are visible in source, but the cited E2E coverage is strongest for password, invite, recovery, magic-link, session, and MFA flows.
