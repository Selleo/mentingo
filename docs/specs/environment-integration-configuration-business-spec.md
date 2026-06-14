# Environment and Integration Configuration Business Spec

## Business Overview

Environment and integration configuration gives administrators controlled access to tenant-level operational settings and external API connectivity. It covers two related concerns: managing secrets that enable platform integrations, and issuing integration API keys for external systems that need to synchronize with Mentingo.

For HR and L&D teams, this enables SSO, payment, video, AI, live training, Luma, Slack, and external reporting or provisioning integrations without hardcoding tenant-specific configuration into product code.

## Who Uses It

- Tenant administrators managing integration secrets and feature availability.
- Platform operators validating whether core services such as SSO, Stripe, LiveKit, Bunny, or AI are configured.
- External HRIS, reporting, or provisioning systems using the integration API.
- Administrators generating or rotating integration API keys.

## Feature Functions

- View and edit configured secret values from the admin environment screen.
- Bulk upsert changed environment values.
- Expose safe frontend configuration probes for SSO, Stripe, AI, Luma, and LiveKit availability.
- Invalidate frontend configuration queries after environment updates.
- Record activity logs when environment variables are changed.
- Generate an integration API key and show the raw key only once.
- Store integration API key metadata such as prefix, creation date, and last-used date.
- Require confirmation before rotating an existing integration API key.
- Authenticate external API requests with `X-API-Key`.
- Scope integration requests to a tenant using `X-Tenant-Id`, except tenant discovery.
- Expose integration endpoints for tenant discovery, users, groups, enrollments, and training results.

## End-User Value

Administrators can turn external capabilities on and off without code deployments, while still keeping sensitive values behind permissions and reveal controls. External systems can securely automate user, group, enrollment, and reporting workflows through a stable API instead of manual spreadsheet work.

## How It Works

The admin environment page renders a metadata-driven list of supported secrets. Admins reveal individual values before editing them, then submit only fields that contain changes. The backend stores the updates and exposes public read-only configuration probes where the frontend needs to decide whether login buttons, billing, AI, Luma, or LiveKit functionality should appear.

Integration API key management lives in account settings. Admins can generate a key, copy the raw value immediately, or rotate an existing key after a confirmation dialog. External callers then authenticate through the integration guard and operate on a tenant selected by header. Managing-tenant administrators can access multiple tenants, while tenant admins are limited to their own tenant.

## Key Technical Context

- Main environment API implementation: `apps/api/src/env`.
- Main environment web implementation: `apps/web/app/modules/Admin/Envs/Envs.page.tsx`.
- Main integration API implementation: `apps/api/src/integration`.
- Main integration web implementation: `apps/web/app/modules/Dashboard/Settings/components/IntegrationApiKeyCard.tsx`.
- Admin environment route `/admin/envs` requires `PERMISSIONS.ENV_MANAGE`.
- Integration key management requires `PERMISSIONS.INTEGRATION_KEY_MANAGE`.
- External integration endpoints require `PERMISSIONS.INTEGRATION_API_USE`.
- Supported environment metadata includes OAuth providers, OpenAI, Bunny Stream, Stripe, Slack, Luma, and LiveKit values.

## Test Evidence

- Web E2E covers admin access to environment management, role-based denial for non-admin roles, loading and updating an env value, and frontend SSO button visibility following tenant env values.
- Web E2E covers generating an integration API key and requiring confirmation before rotating an existing key.
- API E2E covers integration key generation, raw-key-once behavior, hash/prefix storage, rotation rate limiting, missing API key rejection, tenant header enforcement, old-key rejection after rotation, tenant scope restrictions, localized/paginated groups, and training-results filtering.
- Activity-log E2E covers recording an update log when env vars are upserted.
