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

When a learner opens a SCORM lesson, Mentingo launches the selected SCO from a separate content website and exposes a SCORM 1.2-compatible runtime API inside that isolated player. The LMS page receives only validated progress messages, then commits them without restarting the active SCO session so the learner can resume later. Saving progress does not restart the active section, allowing navigation to the next SCO as soon as the save completes. When the package finishes, Mentingo updates learning progress and only treats multi-SCO content as complete when the required SCO completion rules are met.

For portability, authorized course managers can export supported Mentingo course content as a SCORM package. Unsupported lesson types require confirmation and may be skipped during export.

## Key Technical Context

- The SCORM API is implemented in `apps/api/src/scorm`; course export support is in `apps/api/src/courses/course-scorm-export.service.ts`.
- The main web surfaces are `apps/web/app/modules/Admin/Scorm`, `apps/web/app/modules/Courses/Lesson/ScormLesson`, and `useScormRuntime`.
- Import endpoints require `COURSE_CREATE`, `COURSE_UPDATE`, or `COURSE_UPDATE_OWN` depending on whether the user creates a course or updates curriculum content.
- Runtime launch, commit, and finish require course read access. Package bytes are served only on a dedicated HTTPS origin using short-lived, renewable delivery grants; the LMS-origin content route no longer serves package bytes. The deployment must restrict that host to delivery reads only.
- The isolated iframe retains SCORM-compatible script, form-handler, and dialog behavior, while native form submission and cross-origin access to the LMS are blocked. Invalid or out-of-order progress messages are ignored, and late commits cannot downgrade completed work except for an explicit full retake.
- Resumable package upload uses the SCORM TUS upload flow before completing the import.

## Test Evidence

Existing API E2E covers import, runtime launch/commit/resume/finish, multi-SCO completion, and learner access rules. Its delivery assertions now check that LMS-host content is unavailable and a grant is required on the content host. Focused tests cover origin policy, grant expiry and actor binding, message sequence recovery, wrapper post-finish behavior, and late-commit merge rules. The web E2E journey has been updated for the nested isolated player, but requires a configured HTTPS content host and a running application stack to execute. Course export E2E continues to cover ZIP creation and unsupported lesson confirmation.
