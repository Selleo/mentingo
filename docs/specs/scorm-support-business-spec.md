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

When a learner opens a SCORM lesson, Mentingo launches the selected SCO in the lesson player and exposes a SCORM 1.2-compatible runtime API to the package. Runtime changes are committed back to Mentingo without restarting the active SCO session, so the learner can resume later. Saving progress does not restart the active section, allowing navigation to the next SCO as soon as the save completes. When the package finishes, Mentingo updates learning progress and only treats multi-SCO content as complete when the required SCO completion rules are met.

Course editors (any course with `COURSE_UPDATE`, their own courses with `COURSE_UPDATE_OWN`), Learn-mode users, and signed-in users eligible for the public free-course preview can play SCORM lessons in preview mode. A preview launches the package with a fresh runtime that is never saved: no attempt, lesson progress, or play activity is recorded, and the content grant is re-checked against preview access, so disabling public previews stops serving the package. Guests in preview still see the lesson description.

For portability, authorized course managers can export supported Mentingo course content as a SCORM package. Unsupported lesson types require confirmation and may be skipped during export. The export runs as a background job on the native package queue: the editor sees stage progress, and the finished package downloads straight from storage. Files are fetched in parallel and media is stored without recompression. Exporting an unchanged course again within 12 hours reuses the earlier package instead of rebuilding it, and finished packages are removed after a day.

## Key Technical Context

- The SCORM API is implemented in `apps/api/src/scorm`; course export support is in `apps/api/src/courses/scorm-export/course-scorm-export.service.ts`, fulfilled by the native-archive job (`EXPORT_COURSE_SCORM`) and polled through `/api/native-archives/jobs/:id`.
- Preview launches use `GET /api/scorm/runtime/preview`, which skips course-learning state and progress writes.
- The main web surfaces are `apps/web/app/modules/Admin/Scorm`, `apps/web/app/modules/Courses/Lesson/ScormLesson`, and `useScormRuntime`.
- Import endpoints require `COURSE_CREATE`, `COURSE_UPDATE`, or `COURSE_UPDATE_OWN` depending on whether the user creates a course or updates curriculum content.
- Runtime launch, commit, finish, and content streaming require course read access and also verify learner/admin authorization for the package content.
- Resumable package upload uses the SCORM TUS upload flow before completing the import.

## Test Evidence

API E2E coverage verifies SCORM course import, invalid manifest rejection, lesson import, separate language package attachment, runtime launch/commit/resume/finish, multi-SCO completion requirements, authorized content serving, denial for unenrolled learners, editor previews without attempt or progress rows, and public-preview access that stops serving content once previews are disabled. Web E2E coverage verifies SCORM course creation, invalid package blocking, SCORM lesson creation/inspection/deletion, learner launch/resume/fullscreen/finish, and multi-SCO navigation/completion. A focused frontend test verifies that a cache-only runtime update does not finish and restart the active SCO. Course export E2E verifies SCORM zip export through the background job, packaged asset rewriting, rich-text asset export, and confirmation when unsupported lessons will be skipped; unit tests cover building, uploading, and reusing packages in the job, and the export card's progress and download.
