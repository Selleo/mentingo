# SCORM Support Business Spec

## Business Overview

SCORM support lets Mentingo import, deliver, track, and export standards-based e-learning packages. This allows HR and L&D teams to use vendor-supplied training, legacy SCORM content, and internally authored SCORM modules inside the same LMS as native courses.

The feature covers two major workflows: importing SCORM packages as full courses or individual lessons, and running SCORM content for learners with progress persistence. It also supports exporting Mentingo courses as SCORM packages when organizations need portability.

## Who Uses It

- Administrators importing SCORM packages as complete courses.
- Course creators attaching SCORM packages as lessons inside existing curricula.
- Learners launching SCORM lessons, resuming previous progress, navigating SCOs, and completing packages.
- L&D teams exporting compatible course content for external LMS environments.

## Feature Functions

- Create a new SCORM course from a `.zip` package, title, category, language, description, and thumbnail.
- Attach a SCORM package to an existing chapter as a lesson.
- Upload large SCORM packages through resumable TUS import sessions.
- Validate that imported packages contain a SCORM manifest.
- Extract SCORM metadata into courses, chapters, lessons, packages, and SCO records.
- Launch SCORM runtime sessions for authorized learners.
- Persist SCORM runtime data on commit and finish events.
- Resume learner state across launches.
- Require all SCOs to complete successfully where package structure requires it.
- Serve extracted SCORM content only to authorized learners and administrators.
- Export supported Mentingo course content as a SCORM zip.

## End-User Value

Organizations can preserve existing SCORM investments while still using Mentingo as the central learning hub. Learners get continuity through resume and completion tracking. Administrators can mix SCORM and native learning content without having to operate separate systems.

## How It Works

Administrators start from the SCORM course creation screen or from curriculum lesson creation. The frontend collects metadata, uploads thumbnails through the file API, initializes a SCORM import session, streams the package through TUS, and completes the import. Smaller multipart import paths are also supported by the API.

The backend validates the SCORM package, extracts files, stores package and SCO metadata, and creates the appropriate course or lesson structure. During learning, the web player exposes a SCORM 1.2-compatible runtime API using `scorm-again`; set, commit, and finish events are sent back to the API so learner progress can be stored and resumed.

## Key Technical Context

- Main API implementation: `apps/api/src/scorm`.
- Course export support: `apps/api/src/courses/course-scorm-export.service.ts` and related course controller endpoints.
- Main web implementation: `apps/web/app/modules/Admin/Scorm`, `apps/web/app/modules/Courses/Lesson/ScormLesson`, and `apps/web/app/modules/Courses/Lesson/ScormLesson/useScormRuntime.ts`.
- Course import permissions include `COURSE_CREATE`, `COURSE_UPDATE`, and `COURSE_UPDATE_OWN` depending on the operation.
- Shared SCORM constants live in `packages/shared/src/constants/scorm.ts`.

## Test Evidence

- API E2E covers SCORM course import, invalid manifest rejection, SCORM lesson import, attaching separate language packages, runtime launch/commit/resume/finish, completion requirements across SCOs, authorized content serving, and denial for unenrolled learners.
- Web E2E covers choosing standard versus SCORM course creation, importing a SCORM course with generated chapters and lessons, invalid package submit blocking, hiding unsupported admin features on SCORM courses, creating/inspecting/deleting a SCORM lesson, learner launch/resume/fullscreen/finish, and multi-SCO navigation/completion.
- Course export E2E covers exporting SCORM zips, rewriting reused lesson assets into packaged files, exporting rich-text video/downloadable/preview assets, and confirming export when unsupported lessons will be skipped.
