# Course Repetition Business Spec

## Business Overview

Learners can repeat an opted-in course to renew their training while retaining their accepted completion until they finish. Course managers enable repetition in the existing course settings.

Mentingo keeps the accepted course result and one temporary repetition. During repetition, the learner starts with fresh lesson progress and results. Completing it replaces the accepted result. Previous detailed results are removed; this feature does not provide an attempt history.

## Who Uses It

- Learners repeat completed training and resume an unfinished repetition on their next visit.
- Course editors enable repetition for training that learners may need to renew.
- Administrators and group managers check accepted completion alongside ongoing repetition, within their existing course and learner access.

## Feature Functions

- Start a repetition explicitly after completing a course.
- Resume the same repetition after leaving or refreshing the page.
- Show accepted completion and ongoing repetition progress separately.
- Start quizzes, video coverage, SCORM runtime and course AI conversations with fresh learning state.
- Replace the accepted detailed results when repetition completes.
- Replace an active certificate only after a new qualifying certificate is issued successfully.
- Preserve accepted completion and ongoing repetition when a certificate expires.
- Let course editors disable further repetitions while allowing an existing repetition to finish.

## End-User Value

Learners can renew training without temporarily losing proof that they already completed it. Managers can distinguish an accepted outcome from training currently being repeated. Existing reports continue to count each trained learner once, and learning time retains the actual time invested across repetitions.

## How It Works

The learner opens an enrolled, completed course and chooses **Repeat course**. Mentingo starts fresh progress and opens the first lesson. Returning to the course continues that repetition. Ordinary review of completed materials remains a separate existing action.

While repetition is underway, the course shows the accepted completion and repetition progress. Authorized manager details retain accepted results and additionally show how much of the repetition is complete. Reviewing another learner's accepted lesson results does not advance that learner's progress.

When the learner satisfies the existing completion rules, the repeated result becomes current and the temporary repetition disappears. The former detailed lesson and runtime results are removed. There is no list or numbering of earlier attempts.

A prior certificate remains valid until its existing deadline or successful replacement. If the course issues certificates, a new qualifying completion produces the replacement and archives the prior active certificate. A failed issuance leaves the previous accepted result and certificate intact. Certificate expiry affects validity only and does not reset learning, including when validity is shortened. Earned completion remains earned independently of repetition availability or whether the learner has ever repeated; an unfinished course remains unfinished. An explicit administrative certificate reset retains its reset effect and removes the temporary repetition.

Repetition is disabled by default and requires existing course-edit permissions to enable. Starting it requires learner access, enrollment and prior completion. Existing content changes, lesson removal, sequencing and resume rules continue to apply; repetition does not introduce frozen course-content versions.

## Key Technical Context

- The existing course setting is `repetitionEnabled`; learners start repetition through `POST /api/course/:courseId/repeat`.
- One enrollment remains authoritative. Learning state is limited to current and temporary repetition, with tenant isolation and existing group-manager boundaries.
- Learning writes carry a state identity. Duplicate start requests resolve the same repetition, and obsolete writes cannot update another state.
- Completion replacement and certificate issuance use transactions; durable completion notifications reuse the existing outbox.
- Aggregate learning time is retained independently of detailed state replacement, including time spent in an older browser tab after another tab starts repetition. The capability has no plugin dependency.

## Test Evidence

- API integration tests cover eligibility, parallel starts, fresh runtime state, resume, state replacement, stale writes, opt-out, certificates and administrative reset. They exercise real persistence without calling AI providers.
- Frontend component tests cover the explicit action, active repetition after opt-out and failed starts.
- Playwright covers enabling the setting, initial completion, repetition, resume after refresh and replacement through the learner interface.
- These tests do not verify a live AI provider conversation or every third-party SCORM package.
