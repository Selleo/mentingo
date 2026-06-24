# AI Mentor Lessons Business Spec

## Business Overview

AI Mentor Lessons let course creators add interactive practice to a course. Instead of only reading content or answering a fixed quiz, learners can talk with an AI mentor, teacher, or roleplay character, then ask Mentingo to check whether the interaction satisfies the lesson goal.

For HR and L&D teams, this supports practice-heavy learning: handling a difficult customer, rehearsing feedback conversations, explaining a decision, reflecting on a policy scenario, or building confidence before a real workplace interaction.

The main workflow starts in the curriculum builder. A creator defines the task, the mentor persona, the AI instructions, completion conditions, and optional supporting resources. A learner later opens the lesson, reads the task, chats with the mentor, checks their result, and can retake the lesson if they need more practice.

## Who Uses It

- Course creators design AI-guided activities for reflection, teaching, coaching, or real-life roleplay scenarios.
- Learners practice a skill through conversation, receive AI responses, and submit the interaction for completion checking.
- HR and L&D administrators use AI mentor lessons to turn soft-skill or scenario training into measurable course progress.
- Course managers and administrators review AI mentor results in course statistics after learner progress exists.

## Feature Functions

- Create interactive AI mentor lessons from the curriculum builder.
- Configure the learner task, mentor name, avatar, mentor type, AI instructions, completion conditions, and supporting files.
- Offer mentor modes for guided mentoring, teaching-style explanation, and realistic roleplay.
- Let learners read the task, continue an existing conversation, send messages, and receive streamed mentor replies.
- Let learners ask Mentingo to check whether the conversation meets the lesson criteria.
- Mark the lesson complete when the check passes and show a retake path afterward.
- Show AI mentor result rows and read-only conversation previews in course statistics.
- Support microphone entry and voice mentor actions when the relevant voice configuration is available.

## End-User Value

AI Mentor Lessons make training more active and closer to workplace practice. Learners can rehearse decisions, conversations, and explanations in a safe course environment before applying them with colleagues, customers, or managers.

For HR and L&D teams, the feature makes practice trackable. Completion can be tied to the learner's interaction, and managers can review results without leaving the course reporting experience.

## How It Works

A creator adds an AI Mentor lesson, writes what the learner should do, chooses how the mentor should behave, and defines what counts as completion. They can preview the lesson and upload resources that support the interaction.

When a learner opens the lesson, Mentingo initializes or reuses that learner's conversation thread. The learner sees the task, sends messages, and receives AI mentor responses. When they choose the check action, Mentingo evaluates the thread against the lesson conditions. A passed check completes the lesson; a retake archives the prior thread and starts fresh progress.

Voice behavior has two layers. Learners can use microphone-assisted entry in the lesson UI, and when Luma voice mentor configuration is enabled, the primary message action can switch into a voice mentor mode. Luma is Mentingo's connected AI service for voice-enabled mentor behavior; the authoring form also exposes voice configuration controls when that service reports voice support.

## Key Technical Context

- Learner UI lives in `apps/web/app/modules/Courses/Lesson/AiMentorLesson`.
- Authoring UI lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm`.
- AI thread, chat, judge, and retake endpoints live in `apps/api/src/ai/ai.controller.ts`.
- AI mentor lesson create/update endpoints live in `apps/api/src/lesson/lesson.controller.ts`.
- Learner AI access requires `AI_USE`; authoring requires `COURSE_UPDATE` or `COURSE_UPDATE_OWN`.
- AI mentor types and voice mode constants live in `packages/shared/src/constants/aiMentorTypes.ts` and `packages/shared/src/constants/aiMentorVoice.ts`.

## Test Evidence

Frontend E2E tests cover creating and previewing an AI mentor lesson, uploading an AI mentor resource, learner entry into the interaction, voice action visibility when Luma voice is enabled or disabled, the full chat/check/retake flow, and AI mentor statistics review.

The full AI chat E2E test is environment-dependent and skips when OpenAI is not configured. Backend E2E tests in `apps/api/src/ai/__tests__/ai.controller.e2e-spec.ts` cover thread ownership, authentication, authorization, and message retrieval.
