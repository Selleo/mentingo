# Dynamic PWA Branding Business Spec

## Business Overview

Dynamic PWA branding lets each Mentingo organization install the platform as an app whose name, colors, and icon reflect its configured identity. This gives learners a consistent branded experience when they launch Mentingo from a phone or desktop home screen.

Administrators continue to manage the organization name, short name, theme colors, and simple logo in platform settings. Mentingo turns those settings into a tenant-specific web app manifest automatically, so no separate PWA configuration workflow is required.

## Who Uses It

- Platform administrators configure company identity and theme assets once, and those settings are reused for the installable app experience.
- Learners and managers who install Mentingo as a Progressive Web App see the organization's app name, colors, and icon on supported devices.

## Feature Functions

- Present each tenant as an installable, organization-branded web app.
- Build the installed app name from the configured company short name or company name.
- Apply the configured primary and contrast colors to the app manifest.
- Generate square 192 px and 512 px icons from the organization's simple logo.
- Fall back to Mentingo naming, colors, and signet when organization branding is missing.
- Refresh manifest data from current settings instead of relying on a build-time manifest.

## End-User Value

Organizations get a more cohesive learning experience without maintaining a separate mobile application package. Learners can recognize and launch their learning platform more easily, while HR and L&D teams reuse branding they already manage in Mentingo.

## How It Works

An administrator updates the company information, theme colors, or simple logo in Settings. When a supported browser requests installation information, Mentingo returns a manifest for the current tenant using that branding. The installed app uses the organization label with an `LMS` suffix, opens at the platform root in standalone portrait mode, and displays generated square icons when a simple logo is available.

The manifest is public because browsers request it before or outside an authenticated app session. It is returned without persistent caching so later branding changes can be picked up. Existing simple-logo delivery remains public and accepts an internal image-quality selector for the two PWA icon sizes.

## Key Technical Context

- The web document links to `/api/settings/manifest.webmanifest`; the API builds the response from tenant-resolved global settings.
- PWA service-worker generation is configured in `apps/web/vite.config.ts`, while manifest generation stays in the Settings API rather than at build time.
- Updating organization branding remains protected by the existing settings-management permission; reading the manifest and its icon assets is public.
- Simple-logo uploads create normal responsive variants plus dedicated square 192 px and 512 px WebP variants.
- The service worker caches static image and font assets but does not provide a navigation fallback for dynamic application routes.

## Test Evidence

Backend E2E coverage verifies that the public manifest returns tenant-specific naming, theme colors, icon URLs, media types, and no-store headers. Focused image-variant unit tests verify square PWA icon generation, retrieval by requested quality, and cleanup of the additional variants. There is currently no browser E2E test covering the install prompt or installed-app presentation, so those behaviors are inferred from the manifest link and PWA plugin configuration.
