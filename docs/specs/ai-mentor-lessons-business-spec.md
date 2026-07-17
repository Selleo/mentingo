# AI Mentor Lessons Business Spec

## Business Overview

AI Mentor Lessons let course creators add interactive practice to a course. Instead of only reading content or answering a fixed quiz, learners can talk with an AI mentor, teacher, or roleplay character, then ask Mentingo to check whether the interaction satisfies the lesson goal.

For HR and L&D teams, this supports practice-heavy learning: handling a difficult customer, rehearsing feedback conversations, explaining a decision, reflecting on a policy scenario, or building confidence before a real workplace interaction.

The main workflow starts in the curriculum builder. A creator defines the task, mentor persona, AI instructions, a structured AI Judge assessment, and supporting resources. The assessment can be intentionally lightweight, with a task goal but no scored criteria or blockers. When a course is available in multiple languages, creators can translate mentor instructions and Judge text while keeping scores and rubric structure consistent across the course. A learner later opens the lesson, reads the task, chats with the mentor, checks their result, and can retake the lesson if they need more practice.

AI-assisted assessment authoring prepares a complete reviewable Judge draft from a creator brief or improves the configuration currently open in the editor. Mentingo checks deterministic scoring rules and semantic quality before returning the draft, but does not save or publish it automatically.

## Who Uses It

- Course creators design AI-guided activities for reflection, teaching, coaching, or real-life roleplay scenarios.
- Multilingual content creators adapt the AI mentor scenario and structured assessment text to each course language instead of reusing one prompt for every audience.
- Learners practice a skill through conversation, receive AI responses, and submit the interaction for completion checking.
- HR and L&D administrators use AI mentor lessons to turn soft-skill or scenario training into measurable course progress.
- Course managers and administrators review AI mentor results in course statistics after learner progress exists.

## Feature Functions

- Create interactive AI mentor lessons from the curriculum builder.
- Configure the learner task, mentor name, avatar, mentor type, AI instructions, required Judge task goal, optional scored criteria and blocking errors, and supporting files.
- Generate or improve a structured Judge draft from the current lesson context while keeping the creator in control of review and save.
- Check the quality of generated, manually edited, or unsaved Judge values without changing them.
- Localize AI instructions and Judge text per course language while keeping scores, thresholds, IDs, and assessment structure consistent across languages.
- Show missing Mentor and Judge translations as empty authoring fields and include them in the course's missing-translation warning and AI translation action.
- Offer mentor modes for guided mentoring, teaching-style explanation, and realistic roleplay.
- Let the AI mentor address the learner by their real first name naturally in text and voice conversations without weakening the configured role.
- Let learners read the task, continue an existing conversation, send messages, and receive streamed mentor replies.
- Let learners ask Mentingo to check whether the conversation meets the lesson criteria.
- Mark the lesson complete when the check passes and show a retake path afterward.
- Show AI mentor result rows and read-only conversation previews in course statistics.
- Support microphone entry and voice mentor actions when the relevant voice configuration is available.

## End-User Value

AI Mentor Lessons make training more active and closer to workplace practice. Learners can rehearse decisions, conversations, and explanations in a safe course environment before applying them with colleagues, customers, or managers.

For HR and L&D teams, the feature makes practice trackable. Completion can be tied to the learner's interaction, and managers can review results without leaving the course reporting experience.

## How It Works

A creator adds an AI Mentor lesson, which starts in Roleplay mode by default, writes what the learner should do, chooses how the mentor should behave, and configures at least the AI Judge task goal. Criteria and blocking errors remain optional. For a new lesson, applying the Judge dialog stages the configuration until the creator saves the lesson, and Mentingo does not create the lesson without that staged configuration. For an existing lesson, the Judge dialog saves its configuration directly without saving unrelated lesson-form changes. In translated course languages, the same dialog exposes exact translated text instead of masking gaps with base-language values. Structural controls remain visible but disabled with an explanation because scores, thresholds, criteria structure, and blocking-error structure are shared across every language.

In the course base language, a creator can describe the assessment they need or ask AI to improve the complete draft currently in the form. Mentingo creates a structured replacement, checks scoring completeness first, then checks whether the goal, criteria, guidance, examples, threshold, and blockers are meaningful. It can revise the draft up to three times. A successful or review-required result returns to the creator with existing rubric identities preserved where the same item remains; nothing is saved until the creator explicitly applies and saves it. An independent quality check follows the same access and language rules but never generates or persists changes.

Suggested AI Mentor examples populate both the Mentor instructions and a structured Judge rubric in the course base language. Their historical condition lists become independently scored one-point criteria with evidence-based guidance for both zero and full score, localized counterexamples, scenario-specific accepted learner responses, the template's intended passing threshold, and a blocking error for behavior that must fail regardless of score. The Judge treats accepted responses as semantic examples rather than required exact wording. Translated-language use changes Mentor text only and never mutates shared assessment structure.

When a learner opens the lesson, Mentingo initializes or reuses that learner's conversation thread in the learner's active language. The learner sees the task, sends messages, and receives AI mentor responses guided by the matching localized scenario. When they choose the check action, a separate assessment status replaces the conversation controls while Mentingo evaluates every configured criterion, detects configured blocking errors, and calculates points, percentage, and pass/fail on the server. The Judge does not append an artificial Mentor message or generate a separate overall summary: the result presents the deterministic outcome plus feedback attached to each criterion or triggered blocking error. If neither exists, the result explains why detailed feedback is unavailable. A passed check completes the lesson; a retake archives the prior thread and starts fresh progress.

AI Mentor conversations should sound like direct human dialogue rather than generated forms or recaps. Roleplay characters treat lesson instructions as private acting direction, keep the character and learner roles stable across every turn, attribute offers and constraints to the participant who actually stated them, react to the learner one conversational move at a time, avoid parroting the learner's full brief, and use headings or lists only when that format is realistic in the scenario. Mentor and Teacher modes likewise keep response length proportional, avoid mandatory end-of-turn questions, and default to natural prose.

Mentingo gives the AI mentor the current learner's first name so it can address them occasionally when that makes the exchange warmer or clearer. The mentor uses language-aware name forms only when confident, avoids inventing gendered titles or honorifics, and keeps the learner's identity separate from its own persona. The same rule is part of the shared system prompt, so it applies to the opening welcome, normal text responses, and voice conversations while Roleplay characters remain in character.

Voice behavior has two layers. Learners can use microphone-assisted entry in the lesson UI, and when Luma voice mentor configuration is enabled, the primary message action can switch into a voice mentor mode. Luma is Mentingo's connected AI service for voice-enabled mentor behavior; the authoring form also exposes voice configuration controls when that service reports voice support.

## Key Technical Context

- Learner UI lives in `apps/web/app/modules/Courses/Lesson/AiMentorLesson`.
- Authoring UI lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm`.
- AI thread, chat, judge, and retake endpoints live in `apps/api/src/ai/ai.controller.ts`.
- AI-assisted Judge generation and quality-check endpoints live under `/ai/judge-configuration`; lesson-domain authorization derives the course base language and verifies lesson ownership.
- AI mentor lesson create/update endpoints live in `apps/api/src/lesson/lesson.controller.ts`.
- Learner AI access requires `AI_USE`; authoring requires `COURSE_UPDATE` or `COURSE_UPDATE_OWN`.
- AI Mentor instructions and Judge text use exact-language values in the admin editor so missing translations remain visible. Learner delivery may still use the course base language as a fallback where a translation is absent.
- The API determines whether a localized Judge configuration is incomplete and returns that status with the configuration, so the authoring warning uses the same backend translation rules as course-level translation generation.
- The structured AI Judge rubric is the learner Judge's source of truth. Each criterion has a maximum score from 1 through 5. The model returns short references such as `C1` and `B1`; server code maps them to trusted rubric records, validates awarded scores, and calculates totals, percentage, and pass/fail deterministically.
- Luma and the local AI runtime return the same criterion and blocking-error evidence shape. Provider output never decides the final score directly; the Mentingo API applies the trusted rubric and deterministic calculation after either provider responds.
- Existing localized completion-condition values are preserved as Judge task goals during migration. The legacy source column is then removed, and the learner Judge uses only the structured Judge configuration.
- The course's missing-translation generation includes AI Mentor instructions plus Judge task goals, criterion titles and expected behaviors, scoring guidance and existing examples, and blocking-error descriptions without changing Mentor behavior, assessment structure, or scoring.
- Judge criteria are optional. When a configured assessment has no criteria, its total maximum score is zero and the scored assessment is satisfied without applying the percentage threshold; the learner passes unless a blocking error is triggered.
- New AI Mentor lessons default to Roleplay in the authoring form, backend persistence, prompt fallback, and generated-course import fallback; creators can still explicitly choose Mentor or Teacher.
- New AI Mentor lessons require a Judge configuration at creation. AI-generated courses carry the complete structured configuration, and the course import rejects the generated lesson transactionally if that structure is missing or invalid.
- At evaluation time, the API loads the localized task goal, criteria, exact score guidance, accepted examples, and blocking errors as one rubric query. The learner transcript is wrapped in an explicit untrusted-submission boundary and passed to the single authoritative generated Judge prompt.
- Completed judgements retain immutable criterion titles, blocking-error descriptions, awarded/max scores, statuses, and learner-safe evidence. Creators may later remove rubric criteria or blocking errors without deleting or changing the learner's historical result.
- Master-course export and synchronization copy the complete localized Judge graph. Synchronization preserves the target configuration identity while replacing its current criteria, score guidance, examples, and blocking errors transactionally.
- AI mentor types and voice mode constants live in `packages/shared/src/constants/aiMentorTypes.ts` and `packages/shared/src/constants/aiMentorVoice.ts`.
- Learner-name personalization is resolved from the authenticated conversation thread rather than caller-supplied chat content. The name is marked as untrusted prompt data, and the shared policy explicitly preserves the configured Mentor, Teacher, or Roleplay persona.

## Test Evidence

Frontend E2E tests cover creating and previewing an AI mentor lesson, uploading an AI mentor resource, learner entry into the interaction, voice action visibility when Luma voice is enabled or disabled, the full chat/check/retake flow, and AI mentor statistics review. Focused component tests additionally verify the structured Judge editor, translation-mode locking, and validation disclosure.

The full AI chat E2E test is environment-dependent and skips when OpenAI is not configured. Backend E2E tests cover thread ownership, authentication, authorization, message retrieval, localized AI mentor prompt selection, learner-name resolution from thread ownership, required Judge configuration at lesson creation, Judge CRUD permissions, translation-only updates, and cross-tenant master-course Judge graph copy/resynchronization. Focused backend tests verify shared learner-name prompt composition, deterministic Judge scoring, blocking-error overrides, structured prompt safeguards, local-runtime fallback compatibility, exact-language Judge reads, backend-owned Judge translation completeness, normalized Judge text in missing-translation generation, generation retry behavior, independent non-mutating validation, course and lesson authorization, and stable ID reconciliation. Focused frontend tests cover the generation brief form and its progress and review states, but the realtime BullMQ/socket transport and full editor integration do not yet have end-to-end coverage. Generated-course import validation is currently covered by schema and service-level validation rather than a dedicated end-to-end Luma import test.
