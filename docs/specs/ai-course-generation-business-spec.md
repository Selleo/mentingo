# AI Course Generation Business Spec

## Business Overview

AI course generation helps content creators generate an initial course curriculum from a prompt and optional source files. It is designed for empty courses where an admin or creator wants AI assistance to draft chapters and lessons quickly.

For HR and L&D teams, this reduces the blank-page problem in course creation. A team can start with a training topic or uploaded source material, generate a draft structure, and then refine the result in the normal curriculum builder.

The main workflow happens inside the course curriculum tab. When generation is available, the creator opens the AI generation drawer, uploads or references source material, sends a prompt, watches generation progress, and receives generated chapters and lessons inside the course.

## Who Uses It

- Content creators use it to draft course structure and lesson content faster.
- L&D admins use it to accelerate first versions of internal training.
- Tenant admins control availability indirectly through Luma configuration.
- Learners benefit later when generated drafts are reviewed, edited, and published as normal courses.

## Feature Functions

- Show the course generation action only when Luma course generation is configured.
- Hide generation for courses that already have chapters.
- Create or load a generation draft for the current course and language.
- Let creators prompt the AI course generation agent.
- Let creators ingest source files for generation when supported by configuration.
- Stream generation progress in the course generation drawer.
- Create generated chapters and lessons in the existing curriculum.
- Replace generated asset placeholders and ingest generated lesson assets where applicable.

## End-User Value

AI course generation saves time during early course design. It gives L&D teams a starting structure that can be reviewed and edited, while preserving the existing authoring workflow and permission model.

Because generation is limited to empty courses, it reduces the risk of overwriting hand-authored curriculum.

## How It Works

The edit course page checks Luma configuration and the current course structure. If generation is enabled, the course is in its base-language curriculum context, and no chapters exist, the generation button becomes available.

Opening the drawer creates or retrieves a Luma draft tied to the course. The creator sends a prompt and can ingest source files. As the Luma agent streams events, Mentingo transforms generated chapter and lesson events into real course content. When generation finishes, the course curriculum cache is refreshed and the creator can continue editing the generated draft like any other course.

## Key Technical Context

- Frontend course generation UI lives under `apps/web/app/modules/Admin/EditCourse/components/course-generation`.
- Draft loading uses `apps/web/app/api/queries/admin/useCourseGenerationDraft.ts`.
- Backend endpoints live in `apps/api/src/luma/luma.controller.ts`.
- Main backend transformation logic is in `apps/api/src/luma/luma.service.ts`.
- Access requires `COURSE_AI_GENERATION`; Luma configuration is exposed through the env configuration endpoint.
- Generation chat and file ingestion check that the course still has no chapters before proceeding.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/ai/course-generation.spec.ts` cover opening the generation drawer when available, hiding the button when Luma generation is unavailable, hiding the button when a course already has chapters, and starting generation from a prompt.

The prompt-based generation test is environment-dependent and skips when Luma course generation is not configured. Backend behavior is primarily evidenced from source for draft creation, chat streaming, file ingestion, generated chapter/lesson persistence, and Luma error handling.
