# AI Mentor Lessons Business Spec

## Business Overview

AI Mentor Lessons let course creators add interactive practice to a course. Instead of only reading content or answering a fixed quiz, learners can talk with an AI mentor, teacher, or roleplay character, then ask Mentingo to check whether the interaction satisfies the lesson goal.

For HR and L&D teams, this supports practice-heavy learning: handling a difficult customer, rehearsing feedback conversations, explaining a decision, reflecting on a policy scenario, or building confidence before a real workplace interaction.

The main workflow starts in the curriculum builder. A creator defines the task, the mentor persona and name, the AI instructions, completion conditions, and optional supporting resources. When a course is available in multiple languages, creators can maintain a localized mentor name, scenario instructions, and completion criteria for each course language. A learner later opens the lesson and sees the task immediately, chats or speaks with the correctly named mentor, checks their result, and can retake the lesson if they need more practice.

## Who Uses It

- Course creators design AI-guided activities for reflection, teaching, coaching, or real-life roleplay scenarios.
- Multilingual content creators adapt the mentor name, AI scenario, and completion criteria to each course language instead of reusing one version for every audience.
- Learners practice a skill through conversation, receive AI responses, and submit the interaction for completion checking.
- HR and L&D administrators use AI mentor lessons to turn soft-skill or scenario training into measurable course progress.
- Course managers and administrators review AI mentor results in course statistics after learner progress exists.

## Feature Functions

- Create interactive AI mentor lessons from the curriculum builder.
- Configure the learner task, mentor name, avatar, mentor type, AI instructions, completion conditions, and supporting files.
- Localize the mentor name, AI instructions, and completion conditions per course language, with base-language content available as the fallback.
- Include a missing mentor-name translation when checking for gaps and generating course translations with AI.
- Remove the localized mentor name, instructions, and completion conditions when a course language is deleted.
- Offer mentor modes for guided mentoring, teaching-style explanation, and realistic roleplay.
- Show learners the task automatically when they enter an unfinished AI Mentor lesson, while keeping it available for later reference.
- Let learners continue an existing conversation, send messages, and receive streamed mentor replies.
- Let learners ask Mentingo to check whether the conversation meets the lesson criteria from chat or voice mentor mode.
- Mark the lesson complete when the check passes and show a retake path afterward.
- Show AI mentor result rows and read-only conversation previews in course statistics.
- Support microphone entry and voice mentor actions when the relevant voice configuration is available.

## End-User Value

AI Mentor Lessons make training more active and closer to workplace practice. Learners can rehearse decisions, conversations, and explanations in a safe course environment before applying them with colleagues, customers, or managers.

For HR and L&D teams, the feature makes practice trackable. Completion can be tied to the learner's interaction, and managers can review results without leaving the course reporting experience.

## How It Works

A creator adds an AI Mentor lesson, writes what the learner should do, chooses how the mentor should behave, and defines what counts as completion. For multilingual courses, the creator can switch the course content language and save a language-specific mentor name, instructions, and completion conditions. The avatar, voice mode, and supporting resources remain shared lesson settings. Mentingo reports an untranslated mentor name as missing content and can include it when AI generates the course's missing translations. Deleting a course language also removes its AI mentor name, instructions, and completion conditions so retired translations do not remain attached to the lesson. Creators can preview the lesson and upload resources that support the interaction.

When a learner opens an unfinished lesson without an existing evaluation result, Mentingo initializes or reuses that learner's conversation thread in the learner's active language and opens the task description once. Completed lessons and lessons with an available evaluation result do not open it automatically, while the task button remains available for manual review. Learners send messages and receive AI mentor responses guided by the matching localized scenario. When they choose the check action, Mentingo evaluates the thread against the localized lesson conditions and shows the result. On mobile, the task description, result, and retake confirmation use full-width bottom drawers with rounded top corners; on larger screens they remain centered dialogs. A passed check completes the lesson; a retake archives the prior thread and starts fresh progress.

Voice behavior has two layers. Learners can use microphone-assisted entry in the lesson UI, and when Luma voice mentor configuration is enabled, the primary message action can switch into a voice mentor mode. Luma is Mentingo's connected AI service for voice-enabled mentor behavior. Before an evaluation result is available, Mentingo can open the task automatically; afterward, the task button remains available for manual review without reopening it automatically. In voice mode, the task appears in a right-side drawer centered beside the mentor on desktop and as a full-width bottom drawer with rounded top corners on mobile, beneath four compact controls for task, check, microphone, and exit actions. Learners can request AI Judge feedback directly from the top check control. The task panel animates from its task control so its relationship to the source action remains clear. The authoring form also exposes voice configuration controls when that service reports voice support.

## Key Technical Context

- Learner UI lives in `apps/web/app/modules/Courses/Lesson/AiMentorLesson`.
- Authoring UI lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm`.
- AI thread, chat, judge, and retake endpoints live in `apps/api/src/ai/ai.controller.ts`.
- AI mentor lesson create/update endpoints live in `apps/api/src/lesson/lesson.controller.ts`.
- Learner AI access requires `AI_USE`; authoring requires `COURSE_UPDATE` or `COURSE_UPDATE_OWN`.
- AI mentor names, instructions, and completion conditions use the same course-language fallback model as other localized curriculum content.
- AI mentor types and voice mode constants live in `packages/shared/src/constants/aiMentorTypes.ts` and `packages/shared/src/constants/aiMentorVoice.ts`.

## Test Evidence

Frontend E2E tests cover creating and previewing an AI mentor lesson, uploading an AI mentor resource, automatic task display for unfinished lessons, manual reopening at learner entry, suppression after evaluation and completion, voice action visibility when Luma voice is enabled or disabled, the full chat/check/retake flow, and AI mentor statistics review. Component coverage verifies that voice-mode task viewing keeps the overlay visible, the in-overlay check action is available, and the mobile task, microphone, and exit controls remain available while the task is open.

The full AI chat E2E test is environment-dependent and skips when OpenAI is not configured. Backend E2E tests in `apps/api/src/ai/__tests__/ai.controller.e2e-spec.ts` cover thread ownership, authentication, authorization, message retrieval, and localized AI mentor prompt selection. Backend lesson E2E coverage verifies that course editors can save separate mentor names and scenario fields per language, learner and AI prompt flows fall back to the base-language name, untranslated names are included in missing-translation detection, deleting a course language removes all three localized AI mentor fields, and unsupported languages are rejected.
