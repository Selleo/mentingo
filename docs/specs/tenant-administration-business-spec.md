# Tenant Administration Business Spec

## Business Overview

Tenant administration lets managing platform admins create and maintain separate customer or organization workspaces in Mentingo. Each tenant has its own name, host, status, initial admin, settings, users, and tenant-scoped data.

For HR and L&D vendors or enterprise platform operators, this supports a multi-tenant LMS model where several organizations can be operated from one platform without mixing their users or learning data.

The main workflow starts in the super-admin tenant list. A managing admin browses, filters, creates, or edits tenants. When creating a tenant, the admin supplies the tenant identity, host, status, and first tenant admin details. Mentingo provisions the tenant and sends the initial admin invitation.

## Who Uses It

- Super admins use it to browse, create, and update customer or organization tenants.
- Platform operators use it to activate or deactivate tenant workspaces.
- Tenant admins benefit because a newly created tenant receives an initial admin account and default settings.
- Support staff use the tenant list as the launch point for support mode.

## Feature Functions

- Browse and search tenants from a central super-admin list.
- Create a new tenant with name, host, status, and initial admin details.
- Update tenant name, host, and active/inactive status.
- Open tenant details from the tenant list.
- Prevent non-managing users from accessing tenant administration.
- Normalize and validate tenant hosts before saving.
- Prepare a new tenant with default global settings and an invited admin.

## End-User Value

The feature gives platform teams operational control over multi-tenant delivery. It reduces setup effort, keeps organizations separated, and gives admins a repeatable tenant onboarding process. For HR and L&D vendors, this is the foundation for serving multiple client organizations from one product.

## How It Works

A managing admin opens the super-admin tenant list, searches for an existing tenant, or starts a new tenant form. The create form collects tenant name, tenant host, status, and initial admin identity. After submission, Mentingo validates the host, prevents duplicate hosts, creates tenant-level defaults, and creates an admin user for the new tenant with an invitation flow.

When editing an existing tenant, the admin updates the visible tenant identity or status and returns to the tenant list. Status changes let operators make a tenant inactive when access should be disabled. Host changes also refresh the platform's host handling so traffic can resolve to the right tenant.

Access to this area is reserved for users who can manage tenants and who belong to a designated managing tenant. Learners and normal tenant users are redirected away from tenant administration.

## Key Technical Context

- Frontend tenant pages live in `apps/web/app/modules/SuperAdmin` and are routed under `/super-admin/tenants`.
- The tenant API lives in `apps/api/src/super-admin/tenants.controller.ts` and `apps/api/src/super-admin/tenants.service.ts`.
- Tenant administration requires `TENANT_MANAGE` and the `ManagingTenantAdminGuard`, which verifies the current tenant is allowed to manage other tenants.
- Tenant creation uses tenant-scoped setup to add default global settings and create the initial admin in the new tenant.
- Tenant host uniqueness and URL validity are enforced server-side before create/update.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/tenants` prove that managing admins can browse, filter, open details, create tenants, and update tenant details. The same tests prove invalid tenant create/update forms do not persist bad data and that a student cannot access tenant administration.

Backend behavior is primarily evidenced by the tenant controller/service source. There is no dedicated backend tenant controller E2E file in the discovered paths, so API-level tenant behavior should be considered source-evidenced and covered indirectly by web E2E flows.
