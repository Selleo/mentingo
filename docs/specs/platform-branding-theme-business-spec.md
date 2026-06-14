# Platform Branding and Theme Business Spec

## Business Overview

Platform Branding and Theme lets administrators customize the tenant’s visual identity. The feature covers platform logos, simple logos, login background images, certificate backgrounds, and theme colors.

For HR and L&D teams, this supports white-label presentation and a more trusted learner experience. Learners see the platform as part of their organization rather than a generic learning tool.

## Who Uses It

- Platform admins who maintain tenant branding.
- HR and L&D administrators who align the LMS with internal identity guidelines.
- Learners who experience branded navigation, login screens, and certificates.
- External certificate viewers who see tenant-branded certificate assets.

## Feature Functions

- Upload and remove the main platform logo.
- Upload and remove the simple platform logo.
- Upload and remove the login background image.
- Upload and remove the default certificate background image.
- Change primary and contrast theme colors.
- Preview draft theme colors before saving.
- Cancel theme color edits and restore the last saved colors.
- Serve versioned or cached branding image URLs to client screens.

## End-User Value

Organizations can keep the LMS visually aligned with their brand. Learners get a consistent experience from login through course navigation and certificate sharing, while administrators can update visuals without developer involvement.

## How It Works

Administrators open the Platform Customization tab in Settings. Image inputs upload branding assets to the backend and update global settings. Remove actions clear the selected asset. Theme color controls apply draft colors immediately in the browser, then persist them only when the administrator saves.

Global settings expose the saved assets and color values so the app can render tenant-specific branding across public and authenticated screens.

## Key Technical Context

- Frontend customization lives in `CustomizePlatformTabContent`, `OrganizationTheme`, logo forms, login background upload, and certificate background upload components.
- Theme runtime behavior lives in `apps/web/app/modules/Theme`.
- API endpoints include platform logo, simple logo, login background, certificate background, and color schema settings under `apps/api/src/settings`.
- Hex colors are validated with the shared theme color regex.
- Settings image endpoints support versioned URLs and cached image responses.

## Test Evidence

- Web E2E coverage verifies upload and removal for platform logo, simple platform logo, login background image, and certificate background image; it also verifies theme color save-after-reload and cancel-without-persisting behavior.
- API E2E coverage verifies global settings expose versioned image URLs, color schema updates, invalid color rejection, permission denial, and login background public/cached image behavior.
