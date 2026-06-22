# Environment and Integration Configuration Business Spec

## Business Overview

Environment and integration configuration lets administrators manage the operational connections that make tenant-specific features work. It covers two related needs: storing sensitive integration values, and issuing an integration API key for external systems that synchronize with Mentingo.

For HR and L&D teams, this keeps platform connectivity manageable without code changes. Administrators can enable or adjust services such as SSO, payments, AI, video, or live-session infrastructure, while external HRIS, reporting, or provisioning systems can use a governed API for users, groups, enrollments, and results.

The main workflows are split between an admin environment screen for secrets and an account settings card for integration API keys.

## Who Uses It

- Tenant administrators update integration secrets so configured product features can appear and work.
- Platform operators verify whether required services such as SSO, Stripe, AI, Luma, or LiveKit are configured.
- Administrators generate or rotate an integration API key for external automation.
- External HRIS, reporting, or provisioning systems use the integration API to synchronize people, groups, enrollments, and training results.

## Feature Functions

- View, reveal, and update supported tenant secret values from the admin environment screen.
- Refresh frontend availability checks after environment values change.
- Show or hide product capabilities based on safe configuration probes.
- Record activity when environment values are updated.
- Generate an integration API key and show the raw key only once.
- Rotate an existing integration API key after confirmation.
- Let external systems read and update users, groups, course enrollments, and training results through the integration API.
- Restrict integration calls by API key, tenant selection, and integration permissions.

## End-User Value

Administrators can adjust integrations without deployments and without exposing secrets broadly. This makes it easier to maintain SSO, paid-course checkout, AI features, video services, and live-session infrastructure as tenant needs change.

External systems can automate repetitive HR and L&D operations instead of relying on spreadsheets or manual updates. A source-of-truth system can provision users, align group membership, enroll learners, and read training results through a controlled API boundary.

## How It Works

On the environment screen, administrators reveal only the secret they want to inspect or edit. Mentingo submits changed values in bulk, stores them server-side, and refreshes the frontend checks that decide whether related features should be visible.

In account settings, administrators can see integration key status, prefix, creation date, and last-used date. Generating or rotating a key shows the raw key immediately; after that, only metadata remains visible, so the caller must store the key securely.

External callers authenticate with the integration API key. Most integration endpoints also require a tenant header so the request is scoped to the correct tenant. Managing-tenant administrators can operate across allowed tenants, while ordinary tenant administrators are restricted to their own tenant.

## Key Technical Context

- Environment admin route: `/admin/envs`.
- Environment API implementation: `apps/api/src/env`.
- Integration key admin implementation: `apps/api/src/integration/integration-admin.controller.ts` and `apps/web/app/modules/Dashboard/Settings/components/IntegrationApiKeyCard.tsx`.
- External integration API implementation: `apps/api/src/integration/integration.controller.ts`.
- Key permissions are `PERMISSIONS.ENV_MANAGE`, `PERMISSIONS.INTEGRATION_KEY_MANAGE`, and `PERMISSIONS.INTEGRATION_API_USE`.
- Supported environment metadata includes OAuth providers, OpenAI, Bunny Stream, Stripe, Slack, Luma, and LiveKit values.

## Test Evidence

- Web E2E coverage verifies environment screen access control, loading and updating an env value, SSO button visibility from tenant env values, integration key generation, and confirmation before rotating an existing key.
- API E2E coverage verifies integration key generation, raw-key-once behavior, hash/prefix storage, rotation rate limiting, missing API key rejection, tenant header enforcement, old-key rejection after rotation, tenant scope restrictions, localized/paginated groups, and training-results filtering.
- Activity-log E2E coverage verifies that environment updates are recorded.
