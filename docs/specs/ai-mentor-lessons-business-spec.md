# AI Mentor Lessons Business Spec

## Business Overview

AI mentor lessons let creators add AI-guided practice activities to courses. Learners interact with a mentor through chat, optional voice entry points, and a check action that evaluates whether the learner has satisfied the lesson task.

For HR and L&D teams, AI mentor lessons support practice-oriented learning: simulations, reflection, role-play, explanations, and guided exercises that go beyond static content or standard quizzes.

The main workflow starts when a creator adds an AI mentor lesson to a course, configures the task and mentor presentation, and optionally attaches supporting resources. A learner opens the lesson, reads the task, chats with the mentor, asks for a check, and can retake the lesson afterward.

## Who Uses It

- Content creators design AI mentor tasks and mentor details.
- L&D admins use AI mentor lessons for practice-heavy training.
- Learners chat with the mentor, use voice entry points when available, and submit the interaction for evaluation.
- Admins and course authors can review AI mentor result data in course statistics where available.

## Feature Functions

- Create and update AI mentor lessons from the curriculum builder.
- Configure mentor name, avatar, task description, suggested prompts, voice mode, and supporting files.
- Show a task description and mentor conversation in the learner lesson page.
- Stream learner chat messages and mentor responses.
- Show voice input and voice mentor actions depending on Luma voice configuration.
- Let learners ask the AI judge to check the lesson.
- Mark the lesson complete when the judge passes the interaction.
- Let learners retake the AI mentor lesson by archiving the old thread and starting fresh progress.

## End-User Value

AI mentor lessons give learners a more interactive way to practice soft skills, communication, decision-making, or scenario-based tasks. HR and L&D teams can turn practice into measurable completion while keeping the experience inside the course flow.

Voice capability, when configured, lowers friction for conversational practice and makes the activity feel closer to a live coaching interaction.

## How It Works

Creators add an AI mentor lesson in the curriculum builder and configure the learner-facing task. When learners open the lesson, Mentingo initializes or reuses their mentor thread and shows prior messages so the conversation survives reloads.

Learners send text messages or use voice input. The AI response streams into the lesson. When the learner clicks check, the backend runs the AI judge against the thread. If the judge marks the interaction as passed, Mentingo records the lesson result and updates progress. Retaking a lesson archives the previous thread and resets the learner's progress for that lesson.

## Key Technical Context

- Learner UI lives in `apps/web/app/modules/Courses/Lesson/AiMentorLesson`.
- Authoring UI lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm`.
- AI thread, chat, judge, and retake endpoints live in `apps/api/src/ai/ai.controller.ts`.
- AI mentor lesson create/update endpoints live in `apps/api/src/lesson/lesson.controller.ts`.
- Learner AI access requires `AI_USE`; authoring requires `COURSE_UPDATE` or `COURSE_UPDATE_OWN`.
- Thread access is limited to the learner, course author, or users with appropriate management access.

## Test Evidence

Frontend E2E tests cover creating and previewing an AI mentor lesson, learner access to AI mentor entry points, voice action visibility when Luma voice is enabled or disabled, and the full chat/check/retake flow.

The full AI chat E2E test is environment-dependent and skips when OpenAI is not configured. Backend E2E tests in `apps/api/src/ai/__tests__/ai.controller.e2e-spec.ts` cover thread ownership, authentication, authorization, and message retrieval.
