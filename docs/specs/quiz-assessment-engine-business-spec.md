# Quiz Assessment Engine Business Spec

## Business Overview

The Quiz Assessment Engine lets course authors add scored checks inside Mentingo courses. It gives learners a structured way to answer questions, submit an assessment, see their score, and retake the quiz when the course rules allow it.

For HR and L&D teams, quizzes make learning completion more meaningful. Instead of tracking only whether a learner opened a lesson, teams can require a passing score, control retake attempts, and use quiz completion as part of course progression and certificate workflows.

The core workflow starts in curriculum authoring, where a creator adds a quiz lesson and configures questions plus quiz settings. Learners later answer the quiz in the lesson player, submit their answers, and progress only when the quiz rules are satisfied.

## Who Uses It

- Course authors create quiz lessons and add question types that match the learning objective.
- L&D administrators configure passing thresholds, attempt limits, and cooldowns for assessment governance.
- Learners submit answers, review scores, and retake quizzes when allowed.
- Reviewers grade open answers (brief and detailed responses) that wait for manual review.
- Training managers use quiz outcomes as evidence that learners understood required material.

## Feature Functions

- Create quiz lessons inside the curriculum builder.
- Add single choice, multiple choice, true/false, photo choice, fill-in-the-blanks, brief response, and detailed response questions.
- Reorder questions and edit quiz translations while locking structural edits in non-base languages and showing base-language text as an authoring reference.
- Configure passing threshold, optional attempt limit, and optional retake cooldown.
- Require learners to answer every quiz question before submission.
- Score learner submissions and store question results.
- Hold quizzes with manually graded open answers in a "Waiting for review" state until a reviewer grades them.
- Show feedback after submission, including correct-answer context for failed gap-filling questions when feedback is enabled.
- Hide answer-level feedback after submission, retakes, and privileged lesson views when course quiz feedback is disabled.
- Mark the lesson complete only when the learner passes the quiz.
- Let learners retake eligible quizzes and show why retake is unavailable when attempts or cooldown rules block it.

## End-User Value

Quizzes help organizations confirm knowledge, not just content exposure. HR and L&D teams can add lightweight assessments to compliance, onboarding, or skills training, while learners get clear feedback about their score and whether another attempt is available.

## How It Works

A course author adds a quiz lesson in the curriculum builder, gives it a title, chooses question types, fills in answer options or response fields, and configures assessment rules. If the course is translated, Mentingo allows translation edits while preventing non-base-language structural changes such as adding or reordering questions. Empty translated quiz fields show their base-language text as a placeholder; structured gap-fill sentences show a separate read-only base-language preview so authors can translate them without changing the underlying blank structure.

A learner opens the quiz lesson, answers every rendered question, and submits the form. Mentingo validates that no expected question is missing, evaluates the answers, calculates the percentage score, and compares the result with the passing threshold. Passing submissions complete the lesson and can unlock course progression; failed submissions keep progression rules in place.

After submission, learners can review which answers were accepted when quiz feedback is enabled for the course. Answer content follows the selected course content language, falling back to the course base language when unavailable. The UI supplies localized feedback headings; the API returns answer content without a “Correct answer” prefix. Fill-in-the-blanks questions show the correct completed sentence for failed answers, so learners can understand the intended wording instead of seeing only the words they chose. When course feedback is disabled, Mentingo still records the score and submitted answer but keeps answer-level correction details hidden, including after a learner starts and submits a retake or when an admin opens the lesson view.

Brief and detailed responses are graded manually. When a submission contains them, Mentingo grades the automatic questions right away but saves each open answer as pending with 0 points and keeps the whole attempt pending, without a score, result, or graded date. The lesson is not completed, no quiz-completed or lesson-completed event is emitted, and the learner sees "Waiting for review" on the quiz, in the course outline, and in the lesson sidebar. While waiting, the learner sees their own submitted answers but no score and no right or wrong marks, and cannot resubmit or retake the quiz. The pending attempt still counts toward the attempt limit and cooldown. Learner statistics and course quiz results leave pending attempts out, and certificates cannot be issued because the lesson stays incomplete. If the learner repeats the course, the pending attempt stays with the earlier run. Admins in learning or support mode and freemium learners follow the same rule. Answers auto-graded before this rule was introduced keep their original result. Quizzes without open questions are graded immediately as before.

When a learner retakes a quiz, Mentingo first checks the attempt limit and cooldown. If retake is allowed, previous answers are cleared and a new attempt begins. If not, the retake button remains disabled and the interface explains the remaining limit or cooldown.

## Key Technical Context

- Learner quiz delivery lives in `apps/web/app/modules/Courses/Lesson/Quiz.tsx` and the question components under `apps/web/app/modules/Courses/Lesson/Question`.
- Quiz authoring lives in `apps/web/app/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm`.
- The translated quiz editor loads the selected and base-language course variants through the existing localized course query. Questions are paired by their shared identity, while language-specific answer rows are paired by structural position.
- Quiz evaluation and retake orchestration are implemented in `apps/api/src/lesson/services/lesson.service.ts`; target-schema delivery and scoring live in `apps/api/src/quiz/services/quiz-runtime.service.ts`. Dedicated services coordinate quiz authoring and attempt persistence; repositories execute all database reads, writes, and transactions. Attempt writes participate in the caller’s transaction when one is supplied.
- Gap-filling result feedback is built from the localized target assessment definition and the learner's latest target attempt, including the submitted text and accepted answers.
- Passing quiz completion publishes a `QuizCompletedEvent` through the outbox and updates student lesson progress. A submission awaiting review publishes no completion events; grading by a reviewer completes it.
- Questions with grading mode `manual` (brief and detailed responses) make the attempt pending; "awaiting review" is derived from a pending attempt in the learner's active learning state (`apps/api/src/quiz/quiz-awaiting-review.sql.ts`), not stored on lesson progress.
- SCORM exports grade in the learner's browser without a reviewer, so open answers there count as participation: any non-empty answer earns full points.
- Match-words and scale question types exist in code paths but are not exposed in the current question selector.

## Test Evidence

Frontend E2E coverage verifies quiz authoring for choice, text, fill-in-the-blanks, and photo questions; confirms unavailable question types in the builder; verifies learner submission with every rendered question type ending in "Waiting for review"; covers quiz retake, final-quiz retake after certificate completion, blocked progression after failing a required quiz, visible text gap-fill correction when feedback is enabled, and hidden gap-fill correction after retake when feedback is disabled. Unit coverage verifies base-language placeholder matching, including duplicate option display orders and readable gap-fill previews, as well as fallback correct-sentence rendering for completed fill-in-the-blanks questions. Backend E2E coverage verifies feedback redaction for learners, admins, and course authors when the course setting disables feedback. It also covers translated authoring and feedback, base-language fallback, preserving answer identities after translated edits, and rolling back a submitted attempt with its caller’s transaction. Open-answer review coverage verifies the pending attempt and answers, incomplete lesson progress, no quiz-completed event, statistics ignoring the pending attempt, the awaiting-review lesson and course status without correctness details, blocked resubmission and retake, and unchanged immediate grading for quizzes without manual questions. The curriculum language E2E test proves that translated content remains editable while base-language structure is protected, but a browser-level assertion for the new placeholder presentation remains to be added.
