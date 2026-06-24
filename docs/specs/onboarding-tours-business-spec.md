# Onboarding Tours Business Spec

## Business Overview

Onboarding Tours help learners understand key Mentingo pages the first time they use them. Instead of relying on separate instructions or support messages, Mentingo can guide a learner through visible areas of the dashboard, courses, announcements, profile, settings, and provider information pages.

The feature is designed to reduce friction during first use. Learners receive short, page-specific guidance only where it is relevant, and Mentingo remembers which tours they have already completed so the same guidance does not keep interrupting them.

For HR and L&D teams, guided onboarding supports faster adoption of the learning platform. Learners can discover where to check progress, find courses, review announcements, manage account settings, view certificates, and read provider information without needing manual walkthroughs from administrators.

## Who Uses It

- New learners use page-level guidance to understand important learning, profile, announcement, settings, and provider-information areas.
- Returning learners can reset onboarding from account settings when they want to see the product guidance again.
- HR, L&D, and support teams benefit from fewer basic navigation questions because first-use guidance is built into the learner experience.

## Feature Functions

- Show guided steps on key learner pages such as dashboard, courses, announcements, settings, profile, and provider information.
- Localize tour text through the normal Mentingo interface language system.
- Open a page tour only when the signed-in user has not completed that tour yet.
- Mark a page tour as completed when the learner reaches the final step.
- Persist onboarding completion per user and per page.
- Let a user reset onboarding from account preferences.
- Keep completed tours from repeatedly interrupting normal platform use.

## End-User Value

Onboarding Tours make Mentingo easier to adopt without adding administrator work. Learners get contextual help at the moment they need it, and HR or L&D teams can roll out the platform with less dependency on separate training calls, screenshots, or support instructions.

## How It Works

When a learner opens a supported page, Mentingo checks whether that user's tour for the page is already complete. If it is not complete, the page supplies a short set of guided steps and opens the tour after the page finishes loading. When the learner reaches the final step, Mentingo records that the page tour is complete for that user.

The account settings page includes a reset option. When a user resets onboarding, Mentingo clears the saved completion state for all supported onboarding pages, so tours can appear again the next time those pages are visited.

Tours are skipped in test/E2E environments so automated tests can exercise the pages without UI overlays changing the interaction flow.

## Key Technical Context

- The shared onboarding pages are defined in `packages/shared/src/types/onboarding.ts`: dashboard, courses, announcements, profile, settings, and provider information.
- The web onboarding setup is implemented in `apps/web/app/modules/Onboarding`, especially `useTourSetup` and the learner step definitions in `routes/student.ts`.
- Completion and reset endpoints are in `apps/api/src/user/user.controller.ts` and `apps/api/src/user/user.service.ts`.
- Users need `PERMISSIONS.ACCOUNT_UPDATE_SELF` to mark or reset their own onboarding status; the provider-information tour is shown only where the user can update learning progress.
- The current-user response includes onboarding status, which lets the frontend decide whether each page tour should appear.

## Test Evidence

Frontend Playwright coverage verifies that a user with onboarding reset access can reset onboarding from account preferences and that the current-user response reflects the reset status. API behavior is covered through the user controller/service implementation; the source search did not find full E2E coverage for every individual guided tour step.
