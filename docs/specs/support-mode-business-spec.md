# Support Mode Business Spec

## Business Overview

Support mode lets a managing admin enter another active tenant for operational support without turning that access into a normal user session. It is designed for platform support, tenant troubleshooting, and customer assistance in a multi-tenant LMS.

For HR and L&D customers, the value is safer support. Platform staff can inspect tenant-facing workflows while the product clearly shows that the session is temporary support access, hides personal account actions, blocks super-admin access from inside the target tenant, and provides an exit path back to the managing tenant.

The main workflow starts from the tenant list. A managing admin selects support mode for a target tenant, Mentingo redirects them into that tenant, shows a support banner with time remaining, and lets them exit back to the original tenant.

## Who Uses It

- Super admins use it to support tenant admins and investigate tenant-specific issues.
- Platform support staff use it to inspect tenant configuration and learner-facing behavior.
- Tenant admins benefit from faster support without sharing credentials.
- Auditors benefit from a distinct support-mode state and support entry events.

## Feature Functions

- Start a temporary support session from a tenant row.
- Redirect the support user into the selected active tenant.
- Show a persistent support-mode banner with remaining time.
- Let the support user exit back to the original tenant.
- Hide super-admin navigation while inside support mode.
- Block personal account settings and profile access while acting in support mode.
- Expire and revoke support sessions after their allowed lifetime.

## End-User Value

Support mode improves operational consistency and access control. It gives support teams enough access to diagnose tenant issues while reducing credential sharing, accidental tenant confusion, and uncontrolled long-lived access. The visible banner also makes the session state clear to the operator.

## How It Works

From the super-admin tenant list, a managing admin clicks the support-mode action for a tenant. Mentingo creates a short-lived grant and redirects the browser to the target tenant's support callback. The callback exchanges the grant for normal app cookies that represent support-mode context rather than a standard user login.

Once inside the tenant, the app shows a warning banner with a countdown and exit button. Super-admin navigation is hidden, the profile link is suppressed, and account settings are not shown. If the timer runs out, the banner initiates support-mode exit. Exiting revokes the support session, clears the session cookies, and redirects the operator back to the original tenant.

Mentingo rejects support sessions into the current tenant and into inactive tenants. It also revokes other active sessions from the same source user into the same target tenant before creating a new one.

## Key Technical Context

- The tenant list initiates support mode through `apps/web/app/api/mutations/super-admin/useCreateSupportSession.ts`.
- The visible support banner is implemented in `apps/web/app/modules/SupportMode/SupportModeBanner.tsx`.
- Backend support session rules live in `apps/api/src/support-mode/support-mode.service.ts` and `apps/api/src/support-mode/support-mode.repository.ts`.
- Support callback and exit endpoints are in `apps/api/src/auth/auth.controller.ts`.
- Support-mode context is explicit on the current user and is used by navigation, settings, profile, and super-admin layout guards.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/tenants/support-mode.spec.ts` prove that a managing admin can enter support mode, lands in the target tenant, sees the banner and timer, cannot access super-admin navigation there, and can exit back to tenant administration.

`apps/web/e2e/specs/settings/support-mode.spec.ts` proves support-mode users do not see account settings and land on the organization tab. Source code also shows support sessions have pending grants, activation, one-hour expiry, revocation, and expired-session cleanup. No separate backend support-mode E2E file was found.
