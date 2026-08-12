# Role And Permission Management Business Spec

## Business Overview

Role and Permission Management controls what each user can see and do in Mentingo. The platform defines system roles such as student, content creator, trainer, and admin, then maps those roles to detailed permissions for learning, content creation, settings, users, billing, integrations, reports, tenant administration, and support operations.

For HR and L&D teams, this creates safe separation of duties. Administrators assign business-readable roles, while Mentingo turns those assignments into precise access rules across API endpoints, routes, navigation, settings cards, and user-management screens.

The main workflow lives in User Management. Administrators create or update users with one or more roles, bulk-change roles for selected users, and inspect a permissions matrix that explains what each system role grants.

## Who Uses It

- HR administrators assign learner, content creator, trainer, or admin roles to match workplace responsibilities.
- L&D administrators separate course authoring, learner access, reporting, and live-training duties.
- Platform administrators rely on tenant-management and settings permissions for operational control.
- Learners and content creators benefit from a focused interface that hides actions outside their assigned roles.

## Feature Functions

- Define system roles and their default permission sets.
- Assign one or more roles when creating or updating a user.
- Bulk-update roles for selected users.
- Filter and display users by assigned role.
- Show a system-role permissions matrix in the user list.
- Show a user's effective permission set on the user details page.
- Protect frontend routes and backend endpoints with permission requirements.
- Revoke sessions and notify affected users when role changes alter their permissions.

## End-User Value

Role and Permission Management reduces access mistakes and keeps sensitive workflows limited to the right users. HR and L&D teams can delegate course authoring, live training, reporting, user administration, and tenant operations without giving everyone full administrator access.

## How It Works

An administrator opens User Management and assigns roles while creating a user, editing a user, or bulk-updating selected users. Mentingo validates that each user keeps at least one role and that the chosen roles are valid for the tenant.

The user list displays assigned role badges and includes a permissions matrix for the system roles. A user details page can also show the effective permissions produced by that user's assigned roles, helping administrators understand what access the user really has.

The default role matrix mirrors supported product behavior: students can read content covered by their read permissions, while trainers do not receive CMS read permissions for News, Knowledge Base articles, or Q&A. Unregistered users see only content explicitly made public when guest access is enabled. Current Q&A authoring and maintenance remain admin-only. The matrix hides grants that do not represent a current user-facing action: the reserved `qa.manage_own` grant and the unused direct-storage `file.delete` endpoint. File removal performed while managing a course, News post, article, or another content entity remains part of that entity's own management permission.

The matrix also omits the technical file-upload permissions from its user-facing rows. Course-authoring uploads continue to use their existing backend capability, while the unused generic file-delete route is removed. Resource Library operations resolve the target entity first and enforce its full or owner-scoped management permission; deleting an asset checks every entity currently using it because the operation removes all of those relations. `article.manage_own` is enforced for draft lists, draft TOC/content, previews, and Resource Library operations. `settings.read_self`, `settings.update_self`, and `statistics.read_self` are enforced on their corresponding self-service API endpoints. Live-training owner wording describes the assigned host behavior implemented by the API.

Every displayed permission has a dedicated description in Czech, German, English, Spanish, French, Lithuanian, and Polish. Descriptions explain organization visibility and role-dependent data scope instead of treating “public” content as necessarily available to unauthenticated visitors or describing content-creator statistics as platform-wide.

When a user's roles change, Mentingo replaces the role assignments and checks whether the effective role set changed. If it did, the platform revokes the user's active sessions and emits a permissions-updated notification so stale access does not continue silently.

## Key Technical Context

- Shared role and permission definitions live in `packages/shared/src/constants/permissions.ts`.
- Backend enforcement uses `@RequirePermission(...)` and `apps/api/src/common/guards/permissions.guard.ts`.
- Frontend route access is centralized in `apps/web/app/config/routeAccessConfig.ts` and enforced by `apps/web/app/Guards/RouteGuard.tsx`.
- User role assignment flows are implemented in `apps/api/src/user/user.controller.ts`, `apps/api/src/user/user.service.ts`, and `apps/web/app/modules/Admin/Users`.
- System roles and rule sets are ensured per tenant through `ensureSystemRolesForTenant` and `PermissionsBackfillService`; the trainer role is only valid when live training is enabled.
- Missing trainer public-content read grants are added to existing system rule sets by the system-permission backfill.

## Test Evidence

Focused backend E2E coverage verifies article owner/non-owner draft, preview, and TOC access (18 tests), Resource Library target ownership and multi-entity deletion behavior (11 tests), and Settings/Statistics self-permission allow/deny behavior (3 tests). Unit tests cover permission-matrix helpers, hidden implementation-only rows, all permission descriptions in every supported locale, route-guard permission matching, and the three self-permission guards. Full web unit tests and API/web typechecks are part of the validation pass; browser Playwright execution remains environment-dependent.
