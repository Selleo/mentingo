# Quiz And Assessment Engine Business Spec

## Business Overview

The quiz and assessment engine lets content creators build scored quiz lessons and lets learners submit answers, receive scoring, retake quizzes when allowed, and complete lessons only when they satisfy quiz rules.

For HR and L&D teams, quizzes provide a lightweight assessment mechanism inside courses. They can confirm that learners understood required material, enforce passing thresholds, and preserve assessment results for course progress and reporting.

The main workflow starts in course authoring, where a creator adds a quiz lesson and configures questions plus quiz settings. Learners later answer every required question, submit the quiz, see their score, and retake it if attempts and cooldown rules allow.

## Who Uses It

- Content creators design quiz lessons and configure question types.
- L&D admins define passing thresholds, attempt limits, and cooldown rules.
- Learners answer quiz questions and retake assessments when allowed.
- Reporting users use quiz results to understand learner performance.

## Feature Functions

- Create quiz lessons with supported question types.
- Support choice, true/false, brief response, detailed response, fill-in-the-blanks, and photo question rendering.
- Configure passing threshold, attempts limit, and quiz cooldown.
- Require learners to answer all quiz questions before submission.
- Score submitted answers and store the learner's result.
- Mark quiz lessons complete only when the learner passes.
- Let learners retake quizzes when attempts and cooldown rules allow.
- Redact quiz feedback for learners when course settings require it.

## End-User Value

Quizzes help organizations move beyond passive content completion. HR and L&D teams can prove that learners passed required checks, while learners get a clear score and retake path when training design allows another attempt.

The threshold and cooldown settings make assessments more controllable for compliance-oriented or mastery-based courses.

## How It Works

Creators configure quiz questions in the curriculum builder. They choose question types and set assessment rules such as passing threshold and retake limits.

Learners answer the quiz in the lesson player. Mentingo validates that all expected questions have answers, evaluates the submission, calculates the score, and updates quiz progress. If the score meets the passing threshold, the lesson is marked complete and course progress can advance. If not, sequence rules can keep later lessons locked.

When a learner retakes a quiz, the system clears the previous student answers only if the learner is eligible under attempt and cooldown rules, then lets the learner submit a new attempt.

## Key Technical Context

- Learner quiz UI lives in `apps/web/app/modules/Courses/Lesson/Quiz.tsx` and `apps/web/app/modules/Courses/Lesson/Question`.
- Quiz authoring UI lives under `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm`.
- Quiz evaluation and retake endpoints are in `apps/api/src/lesson/lesson.controller.ts`.
- Answer evaluation logic is in `apps/api/src/questions/question.service.ts`.
- Quiz completion updates student lesson progress through `StudentLessonProgressService`.
- Access uses learner progress permissions: `LEARNING_PROGRESS_UPDATE` or `LEARNING_MODE_USE`.

## Test Evidence

Frontend E2E tests cover quiz creation for choice, text, fill-in-the-blanks, and photo questions, plus unavailable question types in the curriculum builder. Learner tests cover submitting a quiz with every rendered question type, retaking a quiz lesson, retaking a final quiz after certificate completion, and sequence behavior after failing a required quiz.

Source evidence shows backend validation for missing answers, duplicate completed submissions, passing-threshold scoring, answer storage, retake attempts, cooldown checks, and quiz completion events.
