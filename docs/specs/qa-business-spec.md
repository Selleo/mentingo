# Q&A Business Spec

## Business Overview

Q&A gives organizations a simple place for short question-and-answer guidance. It is useful for common HR, learning-program, platform, or onboarding questions that do not need the richer publishing workflow of Articles.

The feature supports learner self-service and administrator-controlled content maintenance. Learners can browse and open answers in the current language, while authorized administrators can create entries, edit translations, and decide whether Q&A should be visible to public visitors.

For HR and L&D teams, Q&A reduces repetitive support work. It lets teams publish concise answers once, keep them consistent across languages, and make them available inside the same learning environment where employees take courses and read updates.

## Who Uses It

- HR and L&D administrators publish frequently asked questions about learning programs, onboarding, or platform use.
- Content administrators maintain localized Q&A entries and keep answers current as policies or processes change.
- Learners browse the Q&A page to get direct answers without contacting support.
- Public visitors can read Q&A entries when the tenant has enabled public Q&A access.

## Feature Functions

- Browse Q&A entries in an accordion-style list.
- Open a focused Q&A entry from a shared link or query parameter.
- Create a Q&A entry with a selected base language.
- Edit the question title and answer description for each available language.
- Add and remove non-base language versions.
- Delete Q&A entries when permitted.
- Hide entries from non-managers when the current language is not available.
- Control whether Q&A and public Q&A access are enabled at tenant level.

## End-User Value

Q&A helps learners find answers quickly and gives HR or L&D teams a reusable support channel. Multilingual entries improve consistency across international teams, and public access controls let organizations decide whether the guidance is internal-only or visitor-facing.

## How It Works

A learner opens the Q&A page and sees available entries for the current interface language. Each entry expands to show the answer, and a focused Q&A link can open a specific answer directly.

An administrator with Q&A management access can create a new entry, choose its base language, enter the title and description, and save it. When editing, the administrator can switch languages, add a missing translation, update localized text, or remove a non-base translation. The base language cannot be removed.

Tenant settings determine whether Q&A is available at all and whether unauthenticated visitors may access it. If public access is disabled, guests are blocked even though signed-in users can still use Q&A when the feature is enabled.

## Key Technical Context

- The user-facing routes are `/qa`, `/qa/new`, and `/qa/:id`, implemented under `apps/web/app/modules/QA`.
- The backend Q&A API lives in `apps/api/src/qa` and exposes list, detail, create, update, language add/remove, and delete workflows.
- Reading uses `PERMISSIONS.QA_READ_PUBLIC`; management API endpoints require `PERMISSIONS.QA_MANAGE`.
- The Q&A page itself is public at the route level, but `ContentAccessGuard` and backend settings enforce tenant Q&A availability and unregistered-user access.
- Q&A changes publish activity events through the outbox-backed Q&A event handlers.

## Test Evidence

Frontend Playwright coverage verifies Q&A list behavior, create/update/delete flows, role-specific read/manage access, public access on/off behavior, feature-gate navigation, language visibility, and language add/update/delete management. Backend E2E coverage verifies authenticated and guest reads, disabled-feature and guest-access denial, requested-language reads, create/update/delete behavior, invalid bodies, duplicate or unsupported language handling, and base-language deletion protection.
