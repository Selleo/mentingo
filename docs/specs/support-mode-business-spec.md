# Support Mode Business Spec

## Business Overview

Support Mode lets a managing platform administrator enter another active tenant for temporary operational support. It is designed for tenant troubleshooting and customer assistance without asking tenant admins to share credentials.

For HR and L&D customers, the value is safer support. Platform staff can inspect tenant-facing workflows while Mentingo clearly marks the session as temporary support access, hides normal super-admin navigation inside the target tenant, suppresses personal account settings, and provides a visible exit path.

The workflow starts in Tenant Administration. A managing admin selects a tenant, Mentingo grants short-lived support access, redirects the admin into the target tenant, shows a support banner with time remaining, and lets the admin exit back to the managing tenant.

## Who Uses It

- Managing platform admins enter tenant workspaces to investigate configuration or workflow issues.
- Support staff inspect tenant-facing behavior without using customer credentials.
- Tenant admins benefit from faster troubleshooting while their own accounts remain private.
- Compliance and operations teams benefit from support-mode events that distinguish support access from ordinary login.

## Feature Functions

- Start a support session from a tenant row in Tenant Administration.
- Redirect the support user into the selected active tenant.
- Show a persistent support-mode banner with remaining time.
- Exit support mode and return to the original managing tenant.
- Hide super-admin navigation while inside the target tenant.
- Hide account settings and profile access while acting in support mode.
- Prevent support sessions into the current tenant or inactive tenants.
- Expire and revoke support sessions after the allowed lifetime.

## End-User Value

Support Mode gives platform teams enough access to diagnose tenant issues while reducing credential sharing, accidental tenant confusion, and uncontrolled long-lived access. The visible banner and exit flow make the session state clear to the operator.

## How It Works

A managing admin opens the tenant list and clicks the support action for a target tenant. Mentingo creates a short-lived grant and redirects the browser to the target tenant's support callback. The callback exchanges the grant for support-mode cookies that carry support context rather than a normal tenant-user login.

Inside the target tenant, Mentingo shows a warning banner with a countdown and exit button. The app hides super-admin navigation, suppresses the profile link and account settings, and redirects support-mode users away from super-admin routes.

When the support session expires or the operator exits, Mentingo revokes the support session, clears the cookies, and redirects the operator back to the original tenant. Creating a new support session also revokes other active sessions from the same source user into the same target tenant.

## Key Technical Context

- Support session creation is exposed from `apps/api/src/super-admin/tenants.controller.ts` and implemented in `apps/api/src/support-mode/support-mode.service.ts`.
- The support callback and exit endpoints are in `apps/api/src/auth/auth.controller.ts`.
- Support grants last one minute before activation, and support sessions last one hour.
- Support tokens include target tenant, original tenant/user, support session ID, expiry, return URL, and support-mode flags.
- The visible banner is `apps/web/app/modules/SupportMode/SupportModeBanner.tsx`; super-admin and settings guards read support context from the current user.

## Test Evidence

Frontend E2E coverage verifies that a managing admin can enter support mode, lands in the target tenant, sees the support banner and timer, cannot use super-admin navigation there, exits back to tenant administration, and does not see account settings while in support mode. Source evidence covers pending grants, activation, one-hour expiry, revocation, expired-session cleanup, and support-mode enter events. No dedicated backend support-mode E2E spec was found in this pass.
