# Quiz Assessment Engine Business Spec

## Business Overview

The Quiz Assessment Engine lets course authors add scored checks inside Mentingo courses. It gives learners a structured way to answer questions, submit an assessment, see their score, and retake the quiz when the course rules allow it.

For HR and L&D teams, quizzes make learning completion more meaningful. Instead of tracking only whether a learner opened a lesson, teams can require a passing score, control retake attempts, and use quiz completion as part of course progression and certificate workflows.

The core workflow starts in curriculum authoring, where a creator adds a quiz lesson and configures questions plus quiz settings. Learners later answer the quiz in the lesson player, submit their answers, and progress only when the quiz rules are satisfied.

## Who Uses It

- Course authors create quiz lessons and add question types that match the learning objective.
- L&D administrators configure passing thresholds, attempt limits, and cooldowns for assessment governance.
- Learners submit answers, review scores, and retake quizzes when allowed.
- Training managers use quiz outcomes as evidence that learners understood required material.

## Feature Functions

- Create quiz lessons inside the curriculum builder.
- Add single choice, multiple choice, true/false, photo choice, fill-in-the-blanks, brief response, and detailed response questions.
- Reorder questions and edit quiz translations while locking structural edits in non-base languages.
- Configure passing threshold and an optional attempt limit; existing quizzes retain their retake cooldown behavior.
- Randomize question and choice-option order independently, keeping each attempt stable across page reloads.
- Set a shared opening and closing time and a duration limit in minutes.
- Author localized pass/fail messages and a separate explanation for each question.
- Require learners to answer every quiz question before submission.
- Score learner submissions and store question results.
- Show feedback after submission, including correct-answer context for failed gap-filling questions when feedback is enabled.
- Hide answer-level feedback after submission, retakes, and privileged lesson views when course quiz feedback is disabled.
- Mark the lesson complete only when the learner passes the quiz.
- Let learners retake eligible quizzes and show why retake is unavailable when attempts or cooldown rules block it.

## End-User Value

Quizzes help organizations confirm knowledge, not just content exposure. HR and L&D teams can add lightweight assessments to compliance, onboarding, or skills training, while learners get clear feedback about their score and whether another attempt is available.

## How It Works

A course author adds a quiz lesson in the curriculum builder, gives it a title, chooses question types, fills in answer options or response fields, and configures assessment rules. If the course is translated, Mentingo allows translation edits while preventing non-base-language structural changes such as adding or reordering questions.

Before the opening time, learners see a countdown. The Start test button becomes available automatically when the opening time is reached, without a page reload; the learner still chooses when to start the attempt. Returning to a suspended tab refreshes availability immediately.

Before starting and during an active attempt, learners see the configured duration limit and the availability window’s closing date and local time, formatted in the interface language without seconds. The interface explains that the window can cut the attempt short; the active countdown reflects the actual earlier deadline.

A learner starts a timed or randomized quiz with the Start test button. Mentingo records the attempt and its deadline on the server; reloading the page or opening another tab resumes the same attempt and order. The earlier of the closing time and duration limit ends the attempt. A timed-out attempt receives zero points, consumes an attempt, and never passes, even when the configured passing threshold is zero. Expiry is finalized when the open page requests it or the learner next resumes or submits the attempt, without a background timer job.

A learner answers every rendered question and submits the form. Mentingo validates that no expected question is missing, evaluates the answers, calculates the percentage score, and compares the result with the passing threshold. Passing submissions complete the lesson and can unlock course progression; failed submissions keep progression rules in place.

After submission, learners see the author’s pass/fail message and per-question explanations when quiz feedback is enabled for the course. These new messages are also hidden in the learner API before completion or when feedback is disabled. Fill-in-the-blanks questions show the correct completed sentence for failed answers, so learners can understand the intended wording instead of seeing only the words they chose. When course feedback is disabled, Mentingo still records the score and submitted answer but keeps answer-level correction details hidden, including after a learner starts and submits a retake or when an admin opens the lesson view.

Timed or randomized quizzes without a cooldown limit the total number of started attempts, including expired attempts. With a cooldown configured, reaching the attempt limit pauses retakes until the cooldown ends, then permits another batch, matching the existing quiz behavior. Shuffling and availability settings do not hide or clear the cooldown. Another start must fall within the availability window. Existing quizzes without the new configuration retain their existing immediate-answer and cooldown workflow. When a learner retakes an existing quiz, Mentingo first checks the attempt limit and cooldown. If retake is allowed, previous answers are cleared and a new attempt begins. If not, the retake button remains disabled and the interface explains the remaining limit or cooldown.

## Key Technical Context

- Learner quiz delivery lives in `apps/web/app/modules/Courses/Lesson/Quiz.tsx` and the question components under `apps/web/app/modules/Courses/Lesson/Question`.
- Quiz authoring lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm`.
- Quiz settings and active attempt state extend existing lesson/progress records; question explanations use a separate localized field so gap-fill solutions remain intact. A single generated migration adds these three fields.
- Quiz evaluation and retake behavior are implemented in `apps/api/src/lesson/services/lesson.service.ts`; question scoring lives in `apps/api/src/questions/question.service.ts`.
- Gap-filling result feedback uses stored solution text when present and can derive the correct sentence from localized blank markers plus correct answer options for legacy or imported quiz data.
- Passing quiz completion publishes a `QuizCompletedEvent` through the outbox and updates student lesson progress.
- Match-words and scale question types exist in code paths but are not exposed in the current question selector; brief and detailed responses currently evaluate as passing when a single answer is submitted.

## Test Evidence

Frontend E2E coverage verifies quiz authoring for choice, text, fill-in-the-blanks, and photo questions; confirms unavailable question types in the builder; verifies learner submission with every rendered question type; covers quiz retake, final-quiz retake after certificate completion, blocked progression after failing a required quiz, visible text gap-fill correction when feedback is enabled, and hidden gap-fill correction after retake when feedback is disabled. Unit coverage verifies the fallback correct-sentence rendering for completed fill-in-the-blanks questions. Backend E2E coverage verifies feedback redaction for learners, admins, and course authors when the course setting disables feedback. Source evidence covers backend validation for missing answers, duplicate completed submissions, threshold scoring, answer storage, retake attempts, cooldown checks, feedback redaction, and quiz completion events.

Focused API tests cover simultaneous starts, repeated submissions, deadline expiry at a zero passing threshold, opening dates, exhausted attempts, and authored feedback. Browser scenarios cover reload stability, feedback, and actual countdown expiry.
