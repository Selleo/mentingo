# User Management Business Spec

## Business Overview

User Management lets HR and L&D administrators manage people inside a tenant. Admins can browse users, filter and sort the user list, create users, update user details, assign roles and groups, import users from a file, archive accounts, and delete eligible learner accounts.

For learning operations, this turns organizational structure into platform access. Roles control what a person can do, groups help assign or segment training, and account lifecycle actions help teams keep the tenant clean as people join, move teams, or leave.

The main workflow starts on the admin users page. An administrator finds users through search and filters, opens details for one user or selects many users for bulk action, and Mentingo validates and applies the change while keeping sessions and permissions consistent.

## Who Uses It

- HR administrators create, import, update, archive, and delete learner accounts.
- L&D administrators assign roles and groups so people receive the right learning access.
- Platform administrators inspect user permissions and status for access review.
- Learners benefit indirectly because their role, group, language, and account status determine their learning experience.

## Feature Functions

- Browse, search, filter, sort, paginate, and select users.
- Create individual users with name, email, language, and one or more roles.
- Import many users from an Excel/CSV-style file and show imported versus skipped results.
- Update a user's identity fields, status, roles, and groups.
- Bulk-update roles for selected users.
- Bulk-update group assignments for selected users.
- Archive users from the details page or through a bulk action.
- Delete selected student-level users while preventing self-deletion and non-student deletion.

## End-User Value

User Management reduces manual administration and supports structured learning delivery. Admins can onboard individuals or groups, keep access aligned with organizational changes, and safely clean up old learner records without accidentally removing privileged accounts.

## How It Works

An admin opens the users page and filters by keyword, role, archived status, or group. The table supports sorting, pagination, row selection, role/group badges, and navigation to a user's details page. The details page lets the admin edit core fields, roles, groups, and archived status, and review effective permissions.

For high-volume work, admins select users and apply bulk role, group, archive, or delete actions. Bulk role changes cannot include the current admin's own account. Deletion is limited to users who look like learner/student accounts and cannot include the actor; Mentingo soft-deletes eligible users, anonymizes their core identity fields, and deflates affected course statistics.

For imports, admins upload a supported spreadsheet file. Mentingo creates new users, assigns known groups from the file, reports imported users, and reports skipped users such as duplicate emails. Malformed files show an error without completing the import.

## Key Technical Context

- Frontend user management lives in `apps/web/app/modules/Admin/Users` and is routed under `/admin/users`.
- User-management API endpoints are in `apps/api/src/user/user.controller.ts`; lifecycle and bulk rules are in `apps/api/src/user/user.service.ts`.
- Administrative user-management endpoints require `PERMISSIONS.USER_MANAGE`; self-service profile, password, and onboarding endpoints use account-level permissions.
- User creation creates onboarding/settings records, assigns role slugs, and may create a one-year invitation token for password setup.
- Role changes revoke active sessions and send a websocket permissions-updated notification.

## Test Evidence

Frontend E2E coverage verifies browsing, filtering, sorting, pagination, opening details, creating users, invalid and duplicate user creation, updating basic fields, updating roles and groups, importing users, bulk role updates, bulk group assignment, bulk archiving, single-user archiving, and guarded bulk deletion. Backend E2E coverage verifies listing users, fetching users, updating user/group data, password status and changes, deletion protections, user details access, bulk group updates, bulk role updates, own-role-change rejection, and non-admin authorization denial.
