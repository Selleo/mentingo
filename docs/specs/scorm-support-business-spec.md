# SCORM Support Business Spec

## Business Overview

SCORM Support lets Mentingo import, deliver, track, and export standards-based e-learning packages. It allows HR and L&D teams to use vendor-supplied training, legacy SCORM modules, and internally authored SCORM content inside the same platform as native Mentingo courses.

The feature supports both course creation and learner delivery. Administrators can create a full course from a SCORM package or add SCORM as a lesson inside an existing curriculum. Learners can launch the package, move between SCOs when the package has multiple sections, resume previous runtime state, and complete the lesson when SCORM completion rules are satisfied.

For organizations with existing SCORM investments, this reduces migration friction. Mentingo can host SCORM material while keeping learner progress, completion, certificates, and reporting in the same LMS environment.

## Who Uses It

- Course administrators import SCORM packages as new courses when reusing vendor or legacy training.
- Course creators add SCORM packages as lessons inside existing curricula.
- Learners launch SCORM lessons, resume progress, navigate package sections, and complete the learning activity.
- L&D teams export supported Mentingo courses as SCORM packages when content must be portable to another LMS.

## Feature Functions

- Create a draft SCORM course from a `.zip` package, course metadata, category, language, and optional thumbnail.
- Add a SCORM package as a lesson in an existing chapter.
- Attach a separate SCORM package for another lesson language.
- Upload large packages through resumable TUS import sessions.
- Validate that imported packages contain a SCORM manifest.
- Launch SCORM runtime sessions for authorized learners.
- Persist commit, finish, resume, and multi-SCO completion state.
- Export supported Mentingo course content as a SCORM zip.

## End-User Value

SCORM Support helps HR and L&D teams preserve existing content investments while centralizing learning delivery in Mentingo. Learners get a consistent launch and resume experience, and administrators can combine SCORM and native Mentingo lessons without operating separate LMS tools.

## How It Works

An administrator starts from SCORM course creation or from a curriculum lesson form. They upload a SCORM package, add required metadata, and submit the import. Mentingo validates the package, extracts the manifest and content, creates the course or lesson structure, and stores package/SCO metadata for runtime delivery.

When a learner opens a SCORM lesson, Mentingo launches the selected SCO in the lesson player and exposes a SCORM 1.2-compatible runtime API to the package. Runtime changes are committed back to Mentingo, so the learner can resume later. When the package finishes, Mentingo updates learning progress and only treats multi-SCO content as complete when the required SCO completion rules are met.

For portability, authorized course managers can export supported Mentingo course content as a SCORM package. Unsupported lesson types require confirmation and may be skipped during export.

## Key Technical Context

- The SCORM API is implemented in `apps/api/src/scorm`; course export support is in `apps/api/src/courses/course-scorm-export.service.ts`.
- The main web surfaces are `apps/web/app/modules/Admin/Scorm`, `apps/web/app/modules/Courses/Lesson/ScormLesson`, and `useScormRuntime`.
- Import endpoints require `COURSE_CREATE`, `COURSE_UPDATE`, or `COURSE_UPDATE_OWN` depending on whether the user creates a course or updates curriculum content.
- Runtime launch, commit, finish, and content streaming require course read access and also verify learner/admin authorization for the package content.
- Resumable package upload uses the SCORM TUS upload flow before completing the import.

## Test Evidence

API E2E coverage verifies SCORM course import, invalid manifest rejection, lesson import, separate language package attachment, runtime launch/commit/resume/finish, multi-SCO completion requirements, authorized content serving, and denial for unenrolled learners. Web E2E coverage verifies SCORM course creation, invalid package blocking, SCORM lesson creation/inspection/deletion, learner launch/resume/fullscreen/finish, and multi-SCO navigation/completion. Course export E2E verifies SCORM zip export, packaged asset rewriting, rich-text asset export, and confirmation when unsupported lessons will be skipped.
