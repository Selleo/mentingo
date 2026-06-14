# Language and Localization Business Spec

## Business Overview

Language and Localization let Mentingo serve both the interface and learning content in supported languages. Users can choose their UI language, while content creators can manage language versions for courses, curriculum, knowledge-base content, Q&A, news, groups, categories, learning paths, and registration fields.

For HR and L&D teams, multilingual support makes the platform usable across international teams while preserving a clear base-language model for authored content.

## Who Uses It

- Learners who use the platform in their preferred interface language.
- Public visitors who see localized public/auth screens when a language is stored in their browser.
- Content creators who add and edit translated course or content versions.
- Administrators who manage localized organizational content and registration labels.

## Feature Functions

- Switch and persist the user interface language.
- Set the document language and localized navigation after language changes.
- Support English, Polish, German, Lithuanian, and Czech.
- Use browser/local storage language for unauthenticated visitor experiences.
- Add and remove non-base language versions for authored content.
- Preserve base-language rules so structural edits stay controlled.
- Resolve localized fields with fallback to the base language when needed.
- Keep translated curriculum text editable while locking structural changes in non-base languages.

## End-User Value

Learners and employees can use the LMS in a familiar language, reducing friction and support needs. Content teams can deliver the same learning program across regions while keeping structure, translations, and fallback behavior predictable.

## How It Works

Signed-in users change language from Settings. The selected language is saved to user settings, applied to the HTML document, and used by i18n to update navigation and interface copy. Visitors can also receive localized public/auth copy from stored browser language.

For authored content, each entity tracks a base language and available language versions. Editors can add translations and update localized fields. Structural curriculum changes, such as adding chapters or lessons, remain tied to the base language, while translated titles and descriptions can be edited in other languages.

Backend localization helpers resolve the correct localized field for the requested language and fall back to the base language when the requested locale is not available.

## Key Technical Context

- Supported languages are defined in `packages/shared/src/constants/languages.ts`.
- UI language state is managed by `LanguageProvider`, `LanguageStore`, and user settings endpoints.
- Content language selectors exist across courses, curriculum, articles, Q&A, news, groups, categories, learning paths, calendar, and registration fields.
- Backend localized field behavior is centralized in `apps/api/src/localization/localization.service.ts`.
- User language persistence uses `PUT /api/settings`.

## Test Evidence

- Web E2E coverage verifies an admin can switch UI language, navigation localizes, and language persists after reload.
- Web E2E coverage verifies visitors see localized auth copy from stored browser language.
- Curriculum E2E coverage verifies non-base-language curriculum structure is locked while translations can be edited independently.
- API E2E coverage verifies user settings updates can persist language and reject invalid settings data.
