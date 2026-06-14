# Onboarding Tours Business Spec

## Business Overview

Onboarding tours guide users through key pages after they enter the platform. They reduce friction for new learners by pointing out the dashboard, course lists, announcements, settings, profile, and provider information areas that are most relevant to self-service learning.

The feature stores completion per page, so a user is not repeatedly shown the same guide once they have finished or dismissed it. Users can reset onboarding from settings when they want to see the tours again.

## Who Uses It

- New learners discovering the LMS interface for the first time.
- Returning learners who reset onboarding after missing or dismissing guidance.
- Administrators and support teams who want learners to self-orient without manual instructions.
- Product teams adding page-specific tours to learner-facing workflows.

## Feature Functions

- Define page-specific tour steps for dashboard, courses, announcements, settings, profile, and provider information.
- Automatically open a tour when a user has not completed that page's onboarding.
- Mark a page's onboarding as completed when the user reaches the last step.
- Mark onboarding as completed when the user closes the tour through the provider-level close handler.
- Persist completion flags per user and page.
- Reset all onboarding flags for the current user.
- Reopen the tour after reset.
- Skip tour auto-opening in E2E and test environments to keep automated tests stable.

## End-User Value

Learners can understand the platform faster without reading external documentation. Completion tracking keeps the experience from becoming repetitive, while reset gives users a way to revisit guidance after a UI change, support interaction, or long absence.

## How It Works

The web app uses Reactour through a global `TourProvider`. Page modules pass localized step definitions into `useTourSetup`, along with loading state, completion state from the current user, and the matching `OnboardingPages` value. If the user has not completed that page and the app is not running in a test environment, the hook sets the tour steps and opens the tour.

Completion is persisted through generated API client calls to user onboarding endpoints. The backend stores onboarding flags in the `user_onboarding` table, updates a single page flag when completed, and can reset all known pages to `false` for the current user.

## Key Technical Context

- Main web implementation: `apps/web/app/modules/Onboarding`.
- Global tour provider integration: `apps/web/app/modules/Global/Providers.tsx`.
- Main API implementation: `apps/api/src/user/user.controller.ts` and `apps/api/src/user/user.service.ts`.
- Shared page enum: `packages/shared/src/types/onboarding.ts`.
- Completion endpoint: `PATCH /api/user/onboarding-status/:page`.
- Reset endpoint: `PATCH /api/user/onboarding-status/reset`.
- Both onboarding mutations require `PERMISSIONS.ACCOUNT_UPDATE_SELF`.

## Test Evidence

- Web E2E covers resetting onboarding from account preferences and verifies that the current user's settings onboarding flag becomes incomplete again.
- API authentication/current-user tests cover returning onboarding status as part of user payloads.
- Source-level evidence covers tour setup, page-step definitions, close-handler completion, backend persistence, reset behavior, and test-environment auto-skip.
- I did not find a dedicated frontend E2E spec that walks through every onboarding tour step; automated coverage focuses on reset behavior and current-user status.
