# Tenant Administration Business Spec

## Business Overview

Tenant Administration lets managing platform admins create and maintain separate customer or organization workspaces in Mentingo. Each tenant has its own name, host, status, initial admin, settings, users, and tenant-scoped learning data.

For HR and L&D vendors or enterprise platform operators, this enables a multi-tenant LMS model. Several organizations can be served from one product while their users, settings, and learning records remain separated.

The main workflow starts in the super-admin tenant list. A managing admin browses or searches tenants, reviews each organization's latest recorded activity and recent activity volume, creates a new tenant, edits tenant identity or status, launches support mode, or permanently removes an organization that is no longer required. Authorized external systems can use the Integration API for tenant creation, update, deactivation, and permanent deletion when administration needs to be automated.

## Who Uses It

- Managing platform admins browse customer tenants, use recent activity signals to identify organizations that may need attention, and permanently remove obsolete organizations when retention is no longer required.
- Integration operators automate tenant creation, updates, deactivation, and permanent deletion from an authorized external system.
- Platform operators activate or deactivate tenant workspaces.
- Tenant admins benefit because a newly created tenant receives default global settings and an invited admin account.
- Support staff use the tenant list as the starting point for temporary support-mode access.

## Feature Functions

- Browse, search, filter by status, paginate, and open organizations from a central tenant list.
- Review and sort by the latest recorded activity, historical actor email, or rolling 14-day activity volume.
- Hover or focus the latest activity to review the organization's five most recent actions.
- Compare each organization's activity volume with the preceding 14-day period and review its share of active users.
- Create an organization with its host, status, default settings, and invited initial admin.
- Update organization identity, host, and active/inactive status.
- Permanently delete another organization after confirming an irreversible warning.
- Automate organization creation, partial updates, deactivation, and permanent deletion through the Integration API.
- Normalize organization hosts and prevent duplicate or invalid hosts.
- Restrict administration to authorized users in the managing organization and prevent them from deleting their current organization.

## End-User Value

Tenant Administration gives platform teams a repeatable way to onboard and operate multiple organizations. It reduces setup effort, keeps customer environments separated, and helps operators spot quiet or highly active organizations without repeatedly entering individual workspaces.

## How It Works

A managing admin opens Tenant Administration and can immediately compare recent organization activity. The list defaults to active organizations, while the status filter can reveal inactive organizations or all statuses. Organization hosts are displayed without the protocol and constrained to a compact 25-character-width area; hovering or focusing a truncated host reveals its complete value. Each row shows the latest recorded activity with the actor's email, the number of recorded activities in the rolling 14-day window, the percentage change from the preceding 14 days, and unique active users as a share of all current users. Hovering or focusing the dotted latest-activity area reveals the five most recent actions with their dates and actor emails. A zero current-period count is labeled as no activity, and unchanged trends are omitted to keep the table scannable. The admin can sort these signals to bring the newest, oldest, busiest, or quietest organizations into view. Status uses the product badge system, changing trends use compact green or red text and icons, and the managing-organization flag uses a check or minus icon. Search, status filtering, sorting, and pagination keep the current list visible while Mentingo loads updated results.

From the same page, the admin searches for a tenant or starts a new tenant form. Tenant creation collects the tenant identity, host, status, and first admin details. Mentingo normalizes and validates the host, prevents duplicate hosts, creates the tenant, adds default global settings, and creates an invited admin user in the new tenant.

Row-level Edit and Delete actions are grouped in a compact actions menu. When an organization must be removed rather than disabled, the admin chooses Delete from that menu. Mentingo presents an explicit warning that the organization and its tenant-owned users, learning records, activity, and settings will be permanently removed. The admin must confirm before deletion proceeds. The current managing organization cannot be deleted, preventing an admin from removing the workspace that authorizes tenant administration.

When editing a tenant, the admin updates the tenant's name, host, or active/inactive status. An authorized integration can submit the same partial updates for a tenant identified in the API path or permanently delete a tenant that is no longer required. Integration deletion uses the same safeguards as the administrative UI: only a managing organization can perform it, and it cannot delete itself. Host changes refresh platform host handling so traffic resolves to the correct tenant. Status changes let operators make a tenant inactive when access should be disabled.

Access is restricted to users who have tenant-management permission and are operating from a designated managing tenant. Normal tenant users and learners are redirected away from this area.

## Key Technical Context

- Frontend tenant pages live in `apps/web/app/modules/SuperAdmin` and are routed under `/super-admin/tenants`.
- The tenant API lives in `apps/api/src/super-admin/tenants.controller.ts` and `apps/api/src/super-admin/tenants.service.ts`.
- Integration lifecycle endpoints live in `apps/api/src/integration/integration.controller.ts` and reuse the tenant service's validation, update, and deletion safeguards.
- Tenant administration requires `PERMISSIONS.TENANT_MANAGE` and `ManagingTenantAdminGuard`.
- Hard deletion uses the tenant foreign-key cascade to remove tenant-scoped relational records atomically; the API independently rejects attempts to delete the current managing tenant.
- Activity summaries use tenant-scoped audit records and display historical actor emails without exposing role snapshots. The five-action preview is loaded in one additional batched query for the visible organization page rather than one query per row.
- Activity trend compares the rolling last 14 days with the immediately preceding 14 days. Active-user reach counts distinct, non-archived, non-deleted actors in the latest window against all non-archived, non-deleted users in the organization.
- A tenant-and-time database index supports latest-activity and rolling 14-day aggregation across the organization list.
- Tenant creation runs setup inside the new tenant context to create default global settings and the initial admin user.
- Tenant host create/update invalidates the CORS cache so host routing stays current.

## Test Evidence

Frontend coverage verifies protocol-free host display with truncation and a full-value tooltip; activity-summary, five-action hover preview, trend, and active-user reach rendering; activity sort requests; status filtering; the hard-delete confirmation flow; protection of the current organization; tenant browsing; opening details; creation; updates; and denial for non-managing users. Backend E2E coverage verifies role-free latest actor snapshots, the newest-five activity limit, rolling current and previous 14-day activity summaries, distinct active-user reach, activity sorting, active/inactive filtering with matching totals, cascading tenant deletion, and rejection of current-tenant deletion. Integration API E2E coverage verifies tenant creation, partial updates, deactivation, permanent deletion, persisted update values, host normalization, current-managing-tenant protection, and rejection of lifecycle operations from non-managing tenants.
