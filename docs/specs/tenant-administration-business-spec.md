# Tenant Administration Business Spec

## Business Overview

Tenant Administration lets managing platform admins create and maintain separate customer or organization workspaces in Mentingo. Each tenant has its own name, host, status, initial admin, settings, users, and tenant-scoped learning data.

For HR and L&D vendors or enterprise platform operators, this enables a multi-tenant LMS model. Several organizations can be served from one product while their users, settings, and learning records remain separated.

The main workflow starts in the super-admin tenant list. A managing admin browses or searches tenants, creates a new tenant, edits tenant identity or status, and can launch support mode from the tenant row.

## Who Uses It

- Managing platform admins browse, create, and update customer or organization tenants.
- Platform operators activate or deactivate tenant workspaces.
- Tenant admins benefit because a newly created tenant receives default global settings and an invited admin account.
- Support staff use the tenant list as the starting point for temporary support-mode access.

## Feature Functions

- Browse, search, and paginate tenants from a central tenant list.
- Open an existing tenant from the list.
- Create a tenant with name, host, active/inactive status, and initial admin details.
- Invite the initial tenant admin during tenant creation.
- Update tenant name, host, and status.
- Normalize tenant hosts before saving.
- Prevent duplicate or invalid tenant hosts.
- Restrict tenant administration to managing tenants with tenant-management permission.

## End-User Value

Tenant Administration gives platform teams a repeatable way to onboard and operate multiple organizations. It reduces setup effort, keeps customer environments separated, and gives operators a controlled way to manage tenant availability and tenant support.

## How It Works

A managing admin opens Tenant Administration, searches for a tenant, or starts a new tenant form. Tenant creation collects the tenant identity, host, status, and first admin details. Mentingo normalizes and validates the host, prevents duplicate hosts, creates the tenant, adds default global settings, and creates an invited admin user in the new tenant.

When editing a tenant, the admin updates the tenant's name, host, or active/inactive status. Host changes refresh platform host handling so traffic resolves to the correct tenant. Status changes let operators make a tenant inactive when access should be disabled.

Access is restricted to users who have tenant-management permission and are operating from a designated managing tenant. Normal tenant users and learners are redirected away from this area.

## Key Technical Context

- Frontend tenant pages live in `apps/web/app/modules/SuperAdmin` and are routed under `/super-admin/tenants`.
- The tenant API lives in `apps/api/src/super-admin/tenants.controller.ts` and `apps/api/src/super-admin/tenants.service.ts`.
- Tenant administration requires `PERMISSIONS.TENANT_MANAGE` and `ManagingTenantAdminGuard`.
- Tenant creation runs setup inside the new tenant context to create default global settings and the initial admin user.
- Tenant host create/update invalidates the CORS cache so host routing stays current.

## Test Evidence

Frontend E2E coverage verifies tenant browsing, filtering, opening details, create navigation, tenant creation, tenant updates, invalid create/update blocking, and denial for non-managing users. Backend behavior is source-evidenced through the tenant controller/service and is exercised indirectly through the web E2E flows; no dedicated backend tenant controller E2E spec was found in this pass.
