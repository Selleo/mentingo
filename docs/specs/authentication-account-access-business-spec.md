# Authentication And Account Access Business Spec

## Business Overview

Authentication and account access let learners, admins, content creators, and platform operators enter Mentingo through the right path for their organization. The feature covers standard email/password login, public registration when enabled, password recovery, magic-link login, MFA verification, SSO-aware screens, and logout.

For HR and L&D teams, this is the entry point to every learning workflow. It reduces support work by letting users recover accounts independently, supports stronger security through MFA and SSO enforcement, and respects tenant-level registration rules.

The main user workflow starts on the auth pages. A visitor signs in, registers, requests a reset link, uses a magic link, or completes MFA. After successful authentication, Mentingo sets the session and redirects the user into the learning experience, usually the course catalog.

## Who Uses It

- Learners use it to register, sign in, recover access, and continue training.
- HR and L&D admins use it to access management workflows and protect admin accounts with MFA.
- Platform admins use it with tenant-level SSO, registration, and security settings.
- Public visitors use it when public registration, password recovery, or magic-link access is available.

## Feature Functions

- Let users sign in with email and password.
- Let visitors register new learner accounts when registration is open.
- Send password recovery links and let users reset credentials.
- Send magic-link emails for passwordless login.
- Require MFA setup or verification when enabled by user preference or role policy.
- Support OAuth/SSO entry points for Google, Microsoft, and Slack when configured.
- Keep sessions active through refresh tokens and clear them on logout.

## End-User Value

The feature improves learner experience and operational reliability by giving users several safe ways to access the platform. It helps HR reduce account-access support tickets, supports enterprise security expectations, and lets organizations control whether users can self-register or must use SSO/invitations.

## How It Works

A user opens the login page and chooses a sign-in route. If email/password login is allowed, Mentingo validates the credentials, checks whether MFA is required, and either sends the user to MFA or into the app. If SSO is enforced, the UI hides the password flow and guides the user toward configured providers.

Visitors can register when invite-only registration and SSO enforcement are not blocking it. The registration form validates required identity fields, password strength, age limit when configured, language, and any tenant-specific registration checkboxes. Successful registration creates the account, signs the user in, and sends them to the learning area.

For recovery flows, a user submits their email, receives a reset or magic-link email, follows the link, and either sets a new password or signs in directly. MFA uses a setup code when the account has not configured MFA yet, then verifies time-based codes on later logins.

## Key Technical Context

- Frontend auth pages live in `apps/web/app/modules/Auth` and are routed under `/auth/*` in `apps/web/routes.ts`.
- API behavior is centered in `apps/api/src/auth/auth.controller.ts` and `apps/api/src/auth/auth.service.ts`.
- Session state is cookie-based, with access and refresh token handling in the auth controller/service flow.
- Tenant settings affect login and registration, especially SSO enforcement, invite-only registration, MFA-enforced roles, login assets, and registration form fields.
- Auth responses include current-user permissions, role slugs, onboarding state, MFA state, and support-mode state so the app can route users correctly.

## Test Evidence

Frontend E2E tests cover sign-in/sign-out, auth page navigation, invalid credentials, public registration, password recovery, magic-link login, and MFA setup/verification in `apps/web/e2e/specs/auth`.

Backend E2E tests in `apps/api/src/auth/__tests__/auth.controller.e2e-spec.ts` cover registration validation, duplicate accounts, language fallback, required registration answers, login cookies, invalid credentials, login rate limiting, logout cookie clearing, token refresh, current-user response, password reset, create-password flows, and MFA issuer behavior.

OAuth provider callback behavior is visible in source but is not covered by the cited Playwright flows in the same depth as password, magic-link, and MFA access.
