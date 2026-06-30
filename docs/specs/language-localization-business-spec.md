# Language and Localization Business Spec

## Business Overview

Language and Localization let Mentingo support international learners and administrators through localized interface text and multilingual learning content. Users can work in a supported interface language, while editors can maintain translated versions of courses, curriculum, articles, Q&A, news, groups, categories, learning paths, live training, calendar content, and registration fields.

For HR and L&D teams, this makes one learning platform usable across multiple countries or language groups. The feature also keeps authored content predictable by separating a base language from additional translations.

The main workflow is simple for learners: choose a preferred interface language and keep using the platform. For content teams, the workflow is to create content in a base language, add language versions where needed, and edit localized fields without breaking the shared structure.

## Who Uses It

- Learners choose a familiar interface language so navigation and learning flows are easier to use.
- Public visitors see localized login, registration, and public content based on stored or browser language.
- Content creators add and maintain translations for courses, lessons, articles, Q&A, news, and learning paths.
- Administrators localize operational content such as groups, categories, registration labels, and live training details.

## Feature Functions

- Switch and persist the user interface language.
- Apply the selected language to navigation, page text, and the browser document language.
- Support English, Polish, German, Lithuanian, Czech, and Spanish.
- Use browser or stored language for unauthenticated visitor experiences.
- Add and remove translated versions of authored content.
- Resolve localized content with fallback behavior when the requested language is unavailable.
- Lock structural curriculum edits to the base language while allowing translation edits in other languages.
- Keep localized admin objects such as groups and categories usable in filters and selection lists.

## End-User Value

Learners and employees can use Mentingo in a language that fits their day-to-day work, reducing friction and support needs. HR and L&D teams can deliver one learning program across regions while keeping structure and reporting consistent.

Content teams can reuse the same course, article, or learning path across languages instead of duplicating whole learning assets for each region.

## How It Works

Signed-in users change their interface language from settings. Mentingo saves the choice to the user's settings, updates the interface language, and applies the language to the page document. Visitors use the stored browser-side language choice or browser detection until they sign in.

Authored content uses base-language and available-language rules. Editors create the primary content in a base language, add translations for supported languages, and edit localized fields for each language. When a requested translation is missing, Mentingo can fall back to the base language so users still see usable content.

Curriculum has an extra safeguard: chapter and lesson structure is controlled from the base language, while translated titles, descriptions, and lesson content can be edited in non-base languages.

## Key Technical Context

- Supported languages are defined in `packages/shared/src/constants/languages.ts`.
- UI language state is managed by `LanguageProvider`, `LanguageStore`, browser-language detection, and settings mutations.
- Backend localized-field behavior is centralized in `apps/api/src/localization/localization.service.ts`.
- User language persistence uses the settings API and `PERMISSIONS.SETTINGS_UPDATE_SELF`.
- Many content endpoints require an explicit `language` parameter to return localized fields.

## Test Evidence

- Web E2E coverage verifies that users can change interface language and keep it after reload.
- Web E2E coverage verifies localized auth copy for visitor-facing pages.
- Curriculum E2E coverage verifies that non-base-language curriculum structure is locked while translations can still be edited.
- API E2E coverage verifies user settings language updates and invalid language-setting rejection.
