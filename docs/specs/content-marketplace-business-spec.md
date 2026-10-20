# Content Marketplace Business Spec

## Business Overview

The content marketplace lets an organization add ready-made courses from a curated catalog instead of building every training from scratch. HR and L&D administrators browse marketplace courses inside Mentingo, filter them by topic and length, and add a course to their own course list with one action.

A copied marketplace course arrives as a read-only shared course. Its content stays owned by the marketplace, so administrators do not maintain it locally, but they still decide when to publish it and who is enrolled. When the marketplace publishes a newer version of a course, the listing shows that the organization's copy is outdated and offers a sync that updates the copy in place while keeping learners' progress.

The marketplace is a connected service (a Mentingo plugin) that platform operators switch on per organization. Mentingo reports which listings were copied, whether copying succeeded, and which copies were later duplicated, so the marketplace can see how its content is used.

## Who Uses It

- HR and L&D administrators find a ready-made course for a skills gap, such as a compliance or onboarding topic, and add it to their organization's courses without authoring it.
- HR and L&D administrators keep marketplace courses current by syncing an outdated copy to the latest version without losing their learners' progress.
- Platform operators connect an organization to the marketplace and check that the connection works, so the marketplace appears only where it is enabled.
- Learners take marketplace courses like any other course once their organization publishes and assigns them (inference from the shared-course behaviour; no learner-specific marketplace screen exists).

## Feature Functions

- Browse marketplace courses with thumbnails, descriptions, languages, category, duration and lesson counts, including a "Recently updated" spotlight.
- Search by keyword, filter by category and duration (under 1 hour, 1–3 hours, over 3 hours), and sort by most recently updated or by title.
- Add a marketplace course to the organization as a read-only shared course and open it once copying finishes.
- See when a copied course is outdated and sync it to the latest marketplace version, keeping learners' progress.
- Duplicate a copied marketplace course into an editable course that still counts toward the marketplace listing's usage.
- Report copies, failed copies, and duplications back to the marketplace for usage reporting.
- Let platform operators connect an organization to the marketplace and check whether the connection is reachable and enabled.
- Show the marketplace only to administrators who may browse it and only for organizations with an enabled connection.

## End-User Value

Organizations launch training faster because they can add finished courses instead of authoring them. Content quality stays consistent because the marketplace owns the course content, and every organization can pick up improvements with one sync instead of re-copying or rebuilding a course. Learners keep their progress when a course is updated, so content refreshes do not disrupt ongoing training. Local administrators keep control of rollout and enrollment, and the marketplace gains reliable usage data for each listing.

## How It Works

An administrator opens the content marketplace from the Courses page. Mentingo shows the catalog served by the marketplace for that organization, with search, category and duration filters, sorting, and paging. Each listing that the organization has already copied links to the local course; a listing whose marketplace version is newer than the copy offers Sync instead of Add to courses.

When the administrator adds a course, Mentingo accepts the request and immediately returns a copy job that the page follows until it finishes. In the background, Mentingo obtains the course package from the marketplace, stores it, and imports it as a read-only shared course; the page then confirms the copy and offers to open the course. Adding the same listing again syncs the existing copy instead of creating a second course: content the newer version changes is updated, lessons it no longer contains are removed, live-training lessons are kept, and learners' progress, including SCORM progress, is preserved. A course that was originally imported as an editable copy is never overwritten by a sync.

If copying fails, the page shows the reason and the marketplace is told that the copy failed. A copy whose package exceeds the 500 MiB archive limit is rejected while it is downloaded, so an oversized package never fills storage.

Duplicating a marketplace course creates an ordinary editable course in the same organization. The duplicate keeps the marketplace origin of its source, so duplicates of duplicates are still attributed to the original listing and reported to the marketplace.

The marketplace is available only when a platform operator has connected the organization. Operators save the marketplace address and API key through the integration API and can check whether the organization reaches the marketplace and whether the marketplace is enabled for it. Only this connection can set the marketplace address, and addresses on private or internal networks are rejected, so an organization cannot be pointed at an internal service. Without an enabled connection, the marketplace entry point is hidden and the marketplace screens report that it is unavailable.

The marketplace itself reads course content from Mentingo through the integration API: a managing-organization key can list an organization's non-archived courses with localized titles, category, duration, and lesson counts, and can export a course as a package that the marketplace publishes as a listing version.

## Key Technical Context

- The web entry point is the `content-marketplace` route, linked from the Courses header and gated in route access and the API by `PERMISSIONS.CONTENT_MARKETPLACE_BROWSE`, which the default Admin role holds. Adding or syncing a course also requires course-creation permission.
- `apps/api/src/content-marketplace/services/content-marketplace.service.ts` orchestrates browsing and copying; copies run through the native archive import in its `SYNC` mode (`apps/api/src/native-archive/native-archive.constants.ts`), which creates or updates a read-only shared course and remembers which local entity each archive entity became.
- Course lineage (listing, version, acquisition) is stored per tenant and drives the "outdated" indicator. Copy and duplication reports are durable outbox events delivered to the marketplace by a retrying queue job that reuses the event ID, so a redelivered report is counted once (`apps/api/src/content-marketplace/handlers/content-marketplace-analytics.handler.ts`).
- The tenant connection is stored as tenant environment values written by `PUT /integration/tenants/:tenantId/plugins/content-marketplace` and checked by the matching `GET`; both need a managing-tenant integration key.
- The marketplace-facing catalog (`GET /integration/courses`) and package export (`POST /integration/courses/:courseId/native-archive` and its job status and download endpoints) need a managing-tenant integration key whose owner may export courses, and only read the tenant selected by the request.
- Copied marketplace courses follow the same read-only shared-course model as centrally shared courses; see [Course Sharing](course-sharing-business-spec.md).

## Test Evidence

API E2E coverage verifies the integration side: saving a marketplace connection for the selected tenant with an encrypted API key, rejecting invalid plugin addresses, reporting reachable, unreachable, and unconfigured connections, and refusing non-managing keys and unknown tenants. Catalog tests cover tenant isolation, archived-course exclusion, keyword search, paging, localized titles with base-language fallback, course metadata, and key requirements. Export tests cover streaming a selected tenant's course package, refusing other tenants' courses and jobs, and access rules.

Native archive E2E coverage verifies the shared-course import: the first import creates a shared course that remembers its source entities, a newer archive updates the course in place while keeping progress, removed lessons are deleted, editable copies are not overwritten, and learning paths cannot be imported as shared courses.

There is no backend E2E for the tenant-facing browse and copy endpoints or for marketplace usage reporting, and no Playwright coverage of the marketplace screens; those flows are supported by implementation review only.
