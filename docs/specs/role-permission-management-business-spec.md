# Role And Permission Management Business Spec

## Business Overview

Role and permission management controls what each user can see and do in Mentingo. The platform defines system roles such as student, content creator, trainer, and admin, then maps each role to a set of permissions for learning, content, settings, billing, integrations, tenant management, reporting, and support operations.

For HR and L&D teams, this protects sensitive workflows while keeping day-to-day access simple. Admins assign business-readable roles, and Mentingo turns them into detailed access rights across the API, routes, navigation, and user-management screens.

The main workflow appears inside user management and protected navigation. Admins assign roles to users and review an effective permissions matrix. Users then see only the routes and controls their permissions allow.

## Who Uses It

- HR admins assign roles that match learner, content, trainer, and admin responsibilities.
- L&D admins rely on permissions to separate course creation, enrollment, reporting, and learner access.
- Platform admins use tenant-management permissions for cross-tenant operations.
- Learners and content creators benefit from a focused interface that hides actions outside their role.

## Feature Functions

- Define system roles and their default permissions.
- Grant users access through one or more assigned roles.
- Show role permissions and effective user permissions in user management.
- Protect backend endpoints with permission requirements.
- Protect frontend routes with permission requirements.
- Hide settings, navigation, and admin controls when the user lacks permissions.
- Refresh user sessions when role assignments change.
- Keep role permissions present for every tenant through backfill and tenant setup.

## End-User Value

The feature creates safer access control and clearer operational ownership. HR can separate learner, creator, trainer, admin, billing, integration, and tenant-management duties without relying only on UI hiding. It also reduces mistakes by redirecting users away from unauthorized routes and blocking protected API calls.

## How It Works

Mentingo stores a user's role assignments and derives permissions from the role's rule sets. When a user signs in or when the app loads the current user, Mentingo returns both role slugs and permissions. The frontend uses those permissions to decide which routes, tabs, navigation items, settings cards, and admin actions are visible.

Backend controllers declare required permissions for protected actions. The permission guard checks the current user's permissions before allowing the request. The frontend route guard mirrors those requirements so users are redirected away from inaccessible pages, but backend checks remain authoritative.

Admins can view a permissions matrix in the user list and a user's effective permissions on the user details page. When an admin changes roles, Mentingo revokes affected sessions and notifies the user so stale permissions do not continue silently.

## Key Technical Context

- Shared role and permission definitions live in `packages/shared/src/constants/permissions.ts`.
- Permission helpers live in `packages/shared/src/utils/permissions.ts` and are reused for frontend access checks.
- Backend enforcement is handled through `@RequirePermission(...)` and `apps/api/src/common/guards/permissions.guard.ts`.
- Frontend route access is centralized in `apps/web/app/config/routeAccessConfig.ts` and enforced by `apps/web/app/Guards/RouteGuard.tsx`.
- Permission lookup and tenant backfill live in `apps/api/src/permissions/permissions.service.ts` and `apps/api/src/permissions/permissions-backfill.service.ts`.
- Role assignment and session revocation behavior is implemented in `apps/api/src/user/user.service.ts`.

## Test Evidence

Frontend tests prove several access outcomes: students cannot access environment management, users without settings management see only account settings, students do not see permission-gated settings cards, and non-managing users cannot access tenant administration. Route guard unit tests also cover permission matching behavior.

User-management E2E tests prove admins can update roles, bulk-update roles, view permission-related user details, and cannot bulk-change their own role. Backend source proves permission enforcement is present at controller/guard level. Dedicated backend permission-guard E2E coverage was not found in the discovered files, so API authorization confidence comes from guard source, protected controller usage, and feature-level E2E flows.
