# Curriculum And Lesson Builder Business Spec

## Business Overview

The curriculum and lesson builder lets content creators structure a course into chapters and lessons, then fill those lessons with learning activities and resources. It is the workspace where a course becomes teachable content rather than only metadata.

For HR and L&D teams, this feature enables repeatable learning design. Teams can organize material into a clear sequence, add different lesson types, translate content, and maintain the course structure over time.

The main workflow happens in the curriculum tab of the edit course page. A creator adds chapters, chooses lesson types, configures each lesson, uploads or links resources, orders the curriculum, and saves translated content where language variants exist.

## Who Uses It

- Content creators build and maintain course structure.
- L&D admins review and update training content.
- Subject-matter experts contribute lesson material and resources.
- Learners consume the resulting chapters and lessons in the learning experience.

## Feature Functions

- Create, edit, delete, and reorder chapters.
- Create, edit, delete, and reorder lessons inside chapters.
- Choose supported lesson types, including content, quiz, AI mentor, embed, SCORM, and live training lessons where enabled.
- Add content lesson resources such as uploaded files and embedded video.
- Build quiz lessons with supported question types such as choice, text, fill-in-the-blanks, and photo questions.
- Create embed lessons with YouTube or external resources.
- Create AI mentor lessons with mentor configuration and preview behavior.
- Maintain translated lesson and chapter content while locking structural edits outside the base language.
- Preserve learner progress dependencies when lessons and chapters are created for enrolled learners.

## End-User Value

The builder gives L&D teams flexibility to design training that fits the subject matter. A compliance course can use structured content and quizzes, a skills course can use AI mentor practice, and external materials can be embedded without sending learners away from the course flow.

Base-language structure rules also protect multilingual courses by keeping the curriculum consistent while allowing translated content to be edited.

## How It Works

In the edit course curriculum tab, the left side shows the chapter and lesson tree while the right side renders the currently selected form. Creators can add a chapter, select a lesson type, complete the type-specific form, and reorder curriculum items.

When the selected course language is the base language, creators can change structure. In non-base languages, the structure is locked and translation-focused edits remain available. The API separates chapter operations, lesson operations, resource upload, quiz evaluation, AI mentor assets, embed lessons, and display-order updates behind permission-protected endpoints.

## Key Technical Context

- Frontend builder code lives under `apps/web/app/modules/Admin/EditCourse/CourseLessons`.
- The edit course screen renders the curriculum tab through `CourseLessons.tsx`.
- Chapter APIs live in `apps/api/src/chapter/chapter.controller.ts` and support reading chapters, creating chapters, updating chapters, reordering chapters, deleting chapters, and updating freemium status.
- Lesson APIs live in `apps/api/src/lesson/lesson.controller.ts` and support content lessons, quiz lessons, AI mentor lessons, embed lessons, live training lessons, SCORM lesson resources, uploads, deletion, and display-order changes.
- Curriculum mutations require `COURSE_UPDATE` or `COURSE_UPDATE_OWN`.
- Language behavior depends on course base language and available locales.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/curriculum` cover chapter creation/update/deletion, chapter reordering, non-base-language structure locks, content lessons, lesson resources, YouTube embeds, external embeds, AI mentor lessons, SCORM lessons, quiz choice questions, quiz text questions, fill-in-the-blanks questions, photo questions, unavailable question types, and deleting a quiz lesson after a student submitted answers.

Backend controller source shows permission-gated APIs for the same curriculum operations. The cited Playwright coverage is broadest around end-to-end authoring behavior in the admin UI.
