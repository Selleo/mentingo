# AI Course Translation

## Business Overview

AI course translation helps course authors prepare multilingual training without manually copying every course, chapter, lesson, quiz, AI Mentor, and AI Judge field into each language version.

HR and L&D teams can add a supported language to a course and ask Mentingo to generate the content that is still missing. Existing translations remain intact, while generated content is assigned to the corresponding authoring field so the translated course remains structurally consistent with its base-language version.

## Who Uses It

- HR and L&D course administrators translate onboarding, compliance, and skills training for multilingual learner groups while retaining control of the authored course.
- Content creators with permission to update their own courses fill translation gaps before publishing or assigning localized learning content.

## Feature Functions

- Generate missing translations for an added course language.
- Cover course structure, lesson content, quiz content, AI Mentor instructions, and structured AI Judge configuration where translations are missing.
- Preserve translations that an author has already supplied.
- Keep generated translations attached to their exact source fields even when an AI provider returns results in a different order.
- Reject incomplete, duplicated, unknown, or malformed AI results before any generated values are saved.
- Support either Mentingo's core AI provider or a configured Luma-connected AI runtime.

## End-User Value

HR and L&D teams can deliver the same training across language groups faster, with less repetitive authoring work. Field-level result validation reduces the risk of publishing a course where a lesson body, title, quiz option, or assessment instruction appears in the wrong place.

## How It Works

An authorized course author adds or selects a non-base course language and chooses **Generate missing translations**. After confirmation, Mentingo finds translatable fields that are empty in that language, sends the base-language content to the configured AI runtime in small groups, and saves the validated translations. The course view refreshes after successful generation.

Each requested field receives an opaque item identifier. The AI response must return every identifier exactly once. Mentingo validates each group independently and restores input order from those identifiers before starting the database transaction. If a result is missing, duplicated, unknown, or malformed, the operation stops and no partial group of translations is imported.

When an AI response changes required rich-text markup or inserts HTML into a plain-text field, the author sees a specific message explaining that the content structure was not preserved and can retry. Count and identifier mismatches retain their separate error message.

Generation is unavailable for the course's base language, for languages not added to the course, and while the master course content cannot be edited.

## Key Technical Context

- The authoring workflow is surfaced in `apps/web/app/modules/Admin/EditCourse` and calls the generated course translation API through the existing TanStack Query mutation.
- The endpoint requires course-update or own-course-update permission and validates the target language against shared supported-language contracts.
- `apps/api/src/ai/services/ai.service.ts` chunks requests and validates identity-safe AI output before returning translations to the course service.
- `apps/api/src/courses/course.service.ts` performs the final import in a database transaction after all generated results have passed validation.
- Luma responses receive runtime shape validation and fall back to the core provider when their structured result is invalid.

## Test Evidence

Focused API unit tests prove that reordered results are realigned by item ID and that missing, duplicated, and unknown IDs are rejected. AI runtime tests prove that malformed Luma translation responses fall back to the core provider. Prompt tests verify that the generated prompt requires every item exactly once with its unchanged identifier.

Existing web E2E helpers cover the language-selection and translation-confirmation UI, but there is no end-to-end test exercising a live AI translation provider; provider behavior remains deterministic at the unit-test boundary.
