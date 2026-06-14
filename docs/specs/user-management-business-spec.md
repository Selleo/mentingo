# User Management Business Spec

## Business Overview

User management lets HR and L&D admins manage people inside a tenant. Admins can browse users, filter and sort the user list, create users, update identity fields, assign roles and groups, import users from a file, archive accounts, and delete eligible learner accounts.

For HR and L&D teams, this feature turns organizational structure into learning access. Users can be assigned to roles and groups that control what they can do and what training they can receive. Bulk actions reduce repetitive admin work when onboarding teams, reorganizing groups, or cleaning up old learner records.

The main workflow starts on the admin users page. An admin searches or filters users, selects one user for details or selects many users for bulk changes, and applies updates. Mentingo validates the change, updates related access, and keeps user sessions consistent when roles change.

## Who Uses It

- HR admins create, import, update, archive, and delete tenant users.
- L&D admins assign groups and roles so people receive the right learning access.
- Platform admins use user details and permission visibility to audit access.
- Learners benefit indirectly because their role, group, language, and account status determine their learning experience.

## Feature Functions

- Browse, filter, sort, paginate, and select users.
- Create individual users with identity, role, and language.
- Import many users from a CSV or spreadsheet-style file.
- Assign roles to one user or many users.
- Assign groups to one user or many users.
- Archive users from a details page or bulk action.
- Delete selected student users while preventing self-deletion and non-student deletion.
- Show a user's effective permissions from assigned roles.

## End-User Value

The feature reduces manual HR administration, supports structured learning delivery, and gives admins control over account lifecycle. Group and role management help map teams, departments, or learner segments to the right access. Guardrails around role changes and deletion reduce operational risk.

## How It Works

Admins open the users page and use keyword, role, status, and group filters to find people. The table supports pagination, sorting, row selection, and navigation to user details. From details, an admin can change core user fields, status, roles, and groups.

For high-volume changes, admins select users and apply bulk role, group, archive, or delete actions. Bulk role changes cannot target the current admin's own account. Deletion is restricted to student-level users and cannot include the current user. When roles change, Mentingo revokes affected sessions and notifies users so their permissions are refreshed.

For imports, admins upload a file. Mentingo creates users, assigns known groups, reports imported users, and reports skipped users such as duplicate emails. Malformed files show an error without creating users.

## Key Technical Context

- Frontend user management lives in `apps/web/app/modules/Admin/Users` and is routed under `/admin/users`.
- API endpoints are in `apps/api/src/user/user.controller.ts`; business rules are in `apps/api/src/user/user.service.ts`.
- User management endpoints require `USER_MANAGE`; self-service account endpoints use account-level permissions.
- User creation and updates publish user activity/invite events through existing outbox patterns.
- Role changes revoke active sessions and send a websocket permission-updated notification.
- Deletion is guarded so admins can delete only student users and cannot delete themselves.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/users` cover browsing, filtering, sorting, pagination, opening details, creating users, duplicate email handling, updating user fields, assigning roles and groups, importing users, bulk role updates, bulk group assignment, bulk archive, single archive, and guarded bulk deletion.

Backend E2E tests in `apps/api/src/user/__tests__/user.controller.e2e-spec.ts` cover listing users, getting a user by ID, updating self-visible data and groups, password status and changes, deletion protections, and user details access. The web E2E suite provides stronger coverage for newer bulk and import workflows than the backend controller E2E file.
