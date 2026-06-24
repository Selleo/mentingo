# Curriculum And Lesson Builder Business Spec

## Business Overview

The curriculum and lesson builder turns a course outline into teachable learning content. Content creators structure courses into chapters and lessons, choose lesson formats, add resources, build quizzes, connect live training or SCORM content, and maintain translations for multilingual delivery.

For HR and L&D teams, the builder supports repeatable learning design. A compliance course can use chapters, reading material, and quizzes; a skills course can include AI mentor practice; and blended programs can combine self-paced lessons with live sessions.

The main workflow happens in the curriculum tab of the course edit page. A creator builds the course structure, configures each lesson, reorders content, and edits translated content while keeping the base-language structure consistent.

## Who Uses It

- Content creators build course chapters and lessons before publishing training.
- L&D administrators review and update curriculum structure for managed courses.
- Subject-matter experts contribute lesson content, quiz questions, embeds, or supporting resources.
- Learners consume the resulting chapter and lesson sequence in learning mode.

## Feature Functions

- Create, edit, delete, and reorder chapters.
- Create, edit, delete, and reorder lessons inside chapters.
- Choose lesson types such as content, quiz, AI mentor, embed, SCORM, and live training where available.
- Add lesson resources including uploaded files and embedded video or external content.
- Build quiz lessons with supported question types.
- Configure AI mentor lessons with mentor setup and preview behavior.
- Edit translated lesson and chapter content while keeping structure changes in the base language.
- Preserve learner progress dependencies when curriculum changes affect enrolled learners.

## End-User Value

The builder gives L&D teams flexibility to match training design to the learning objective. Teams can combine reading, practice, assessment, AI roleplay, external material, and scheduled sessions inside one course instead of forcing every topic into the same lesson format.

Multilingual structure rules protect consistency. Learners in different languages receive the same course shape, while editors can still maintain localized titles, descriptions, lesson text, and resources.

## How It Works

Creators open the curriculum tab and work from a chapter-and-lesson tree. Selecting an item opens the relevant form on the side; adding a lesson first asks for the lesson type, then shows the type-specific fields.

When the selected language is the course base language, creators can change the curriculum structure. In non-base languages, structural controls are locked and the workflow focuses on translation-friendly edits. Mentingo uses this distinction to keep localized courses aligned without blocking content translation.

Some lesson types depend on broader platform configuration or course type. The UI shows the available options for the current course, and the API protects curriculum mutations with course update permissions.

## Key Technical Context

- Frontend builder code lives under `apps/web/app/modules/Admin/EditCourse/CourseLessons`.
- Chapter APIs live in `apps/api/src/chapter/chapter.controller.ts`.
- Lesson APIs live in `apps/api/src/lesson/lesson.controller.ts`.
- Curriculum mutations require `PERMISSIONS.COURSE_UPDATE` or `PERMISSIONS.COURSE_UPDATE_OWN`.
- Language behavior depends on the course base language and available locales.

## Test Evidence

- Web E2E coverage verifies chapter creation, update, deletion, and reordering; non-base-language structure locking; content lessons; lesson resources; YouTube and external embeds; AI mentor lessons; SCORM lessons; quiz choice, text, fill-in-the-blanks, and photo questions; unavailable question types; and deleting a quiz lesson after submitted answers exist.
- API E2E coverage in the lesson area verifies deletion of quiz lessons with linked attempts and learner-facing quiz feedback behavior. Most authoring workflows are covered more directly through Playwright E2E and API source evidence.
