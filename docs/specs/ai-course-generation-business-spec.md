# AI Course Generation Business Spec

## Business Overview

AI Course Generation helps course creators turn a training need into a first curriculum draft without starting from a blank page. A creator can describe the course they need, optionally attach source material, and let Mentingo's connected AI course generation service, Luma, propose chapters and lessons inside the normal curriculum builder.

For HR and L&D teams, this is useful when they need to move quickly from business knowledge to structured training. An HR manager can start an onboarding course from internal documents, or a sales team manager can draft a course about company-specific sales techniques and then refine it before publishing.

The main workflow starts in an empty course. The creator opens the curriculum tab, chooses the AI generation action, explains the course goal in a chat-style drawer, attaches supporting files if needed, and reviews generated course structure as it appears in the course.

## Who Uses It

- Course creators use it to create a first draft of a new course from a topic, audience, expected outcomes, or source documents.
- HR managers use it to turn onboarding policies, internal guides, or compliance material into an editable course outline faster.
- Team managers use it to draft team-specific training, such as a sales technique course based on how their company actually sells.
- Learners benefit after the generated draft is reviewed, edited, and published as a normal Mentingo course.

## Feature Functions

- Speed up early course design by generating chapters and lessons from a creator's prompt.
- Let creators attach supported source files so the AI service can use internal context while drafting.
- Show generation progress in the curriculum builder while the course structure is being created.
- Add generated chapters and lessons directly into the course so creators can continue editing them with existing authoring tools.
- Support generated content, quiz, and AI mentor lesson shapes when the AI output includes them.
- Keep generated work inside the base-language curriculum flow.
- Make generation available only when Luma course generation is configured and the course has no chapters.

## End-User Value

AI Course Generation shortens the path from training idea to editable curriculum. HR and L&D teams can create a structured starting point from company knowledge, then use human review to adapt tone, accuracy, assessments, and publishing readiness.

It keeps the authoring workflow familiar: generated material lands in the same curriculum builder where creators already manage chapters, lessons, resources, and language-specific content.

## How It Works

A creator opens an empty course and starts AI generation from the curriculum area. In the drawer, they explain what the course should teach, who it is for, and what outcomes matter. They can also attach supported source files, such as documents that describe the topic or internal process.

Mentingo sends the conversation and attached context to Luma, the connected AI course generation service. As Luma streams back course-design events, Mentingo turns the visible result into course chapters and lessons. The creator can close the drawer after generation starts, see completion feedback, and then review the generated curriculum like any other course content.

Generation is intentionally limited to eligible empty courses and requires the Luma course generation configuration. That keeps the feature focused on creating first drafts rather than overwriting hand-authored curriculum.

## Key Technical Context

- Frontend UI lives under `apps/web/app/modules/Admin/EditCourse/components/course-generation`.
- Backend integration endpoints live in `apps/api/src/luma/luma.controller.ts`.
- `LumaService` creates or retrieves the draft, streams chat responses, ingests source files, and turns generated chapter/lesson events into Mentingo course content.
- Access requires `COURSE_AI_GENERATION`.
- Luma configuration is exposed through `GET /api/env/luma`; the UI hides generation when `courseGenerationEnabled` is false.
- Chat and file ingestion check that the course still has no chapters before proceeding.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/ai/course-generation.spec.ts` cover opening the generation drawer, hiding the action when Luma generation is unavailable, hiding the action when a course already has chapters, and starting generation from a prompt.

The prompt-based generation test is environment-dependent and skips when Luma course generation is not configured. Backend behavior is evidenced from source for draft creation, streaming, file ingestion, generated chapter/lesson persistence, and Luma error handling.
