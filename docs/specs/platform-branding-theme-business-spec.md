# Platform Branding Theme Business Spec

## Business Overview

Platform Branding and Theme let administrators adapt Mentingo's visual identity to the tenant's organization. The feature supports logos, login imagery, certificate background imagery, and theme colors so the learning experience can feel like an extension of the company's own environment.

This is especially useful for HR and L&D rollouts where learner trust and recognition matter. A branded login page, consistent platform logo, and organization-specific certificates help employees understand that Mentingo is part of their company's learning ecosystem.

The customization workflow is managed from Settings by authorized administrators. They can upload or remove supported branding assets and adjust the primary and contrast colors used across the interface.

## Who Uses It

- Tenant administrators configure platform logos, login imagery, certificate imagery, and color settings for the organization.
- HR and L&D teams use branding to make learning programs feel official and recognizable to employees.
- Learners benefit from a more familiar and trusted platform experience when Mentingo reflects the organization's identity.

## Feature Functions

- Upload and remove the main platform logo.
- Upload and remove the simple platform logo.
- Upload and remove the login background image.
- Upload and remove the certificate background image.
- Change the platform primary color and contrast color.
- Preview color changes in the interface before saving.
- Cancel unsaved color changes and restore the last saved theme.
- Serve configured branding assets through public, cache-aware image URLs.

## End-User Value

Branding improves platform recognition and learner confidence. HR and L&D teams can present training, certificates, and login experiences under the organization's visual identity, while administrators retain control over updates without needing engineering support.

## How It Works

An administrator opens Settings and switches to the platform customization area. From there, Mentingo offers upload controls for platform logos, login background, and certificate background. When a file is uploaded, the tenant's public settings update so the relevant part of the product can render the new asset.

Theme color controls let the administrator adjust the primary and contrast colors. Mentingo applies color changes live while editing, then saves them only when the administrator confirms. Canceling restores the last saved colors so draft changes do not accidentally alter the platform.

Public pages can request the configured assets through versioned image URLs. This lets unauthenticated experiences such as the login page show the tenant's branding while still keeping asset updates cache-friendly.

## Key Technical Context

- The customization UI is assembled in `apps/web/app/modules/Dashboard/Settings/components/admin/CustomizePlatformTabContent.tsx`.
- Theme editing is implemented by `OrganizationTheme` and `apps/web/app/modules/Theme`, which updates CSS color variables for live preview.
- Branding asset and color updates are handled by the Settings API in `apps/api/src/settings/settings.controller.ts`.
- Administrative updates require `PERMISSIONS.SETTINGS_MANAGE`; asset read endpoints are public where unauthenticated pages need branding.
- File uploads reuse existing image validation and settings-image streaming, including versioned/cached URLs for configured assets.

## Test Evidence

Frontend Playwright coverage verifies that admins can upload and remove platform logo, simple logo, login background, and certificate background assets; it also verifies saving theme colors across reloads and canceling draft color changes. Backend E2E coverage verifies versioned settings image URLs, color-schema validation and permission checks, and cache-aware login-background image responses including 304 behavior.
