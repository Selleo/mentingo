# SCORM Course Export PRD

## Summary

Admins and content creators need to export Mentingo courses as SCORM 1.2 packages that can be uploaded into another LMS. The exported package must be self-contained and preserve enough course structure, content, assets, and quiz behavior to run independently of Mentingo.

## Goals

- Export existing courses as SCORM 1.2 zip files.
- Preserve course, chapter, and lesson structure.
- Support content, quiz, and embed lessons in v1.
- Include lesson files and media in the exported package.
- Track completion and quiz score through the LMS SCORM API.
- Allow export for draft and published courses.

## Non-Goals For V1

- Exporting AI mentor lessons.
- Exporting imported SCORM lessons.
- Calling Mentingo APIs from the exported package.
- Supporting SCORM 2004 export.
- Matching every detail of the Mentingo learner UI.

## User Flow

1. Admin or content creator opens a course they can manage.
2. User clicks an explicit SCORM export action.
3. Backend validates whether the course can be exported.
4. If valid, backend generates a SCORM 1.2 zip.
5. User downloads the zip.
6. User uploads the zip into another LMS.
7. Learners complete lessons inside that LMS.

## Export Eligibility

Export is allowed for:

- Draft courses
- Published courses
- Courses owned by the content creator
- Courses accessible to admins through normal course management permissions

Export is blocked when:

- The course contains AI mentor lessons.
- The course contains imported SCORM lessons.
- A required file or resource cannot be resolved.
- The course has no supported lessons.

Embed lessons should not block export only because the external provider may disallow iframe nesting. The package should include a fallback link.

## Course Data Model

The exported package should use one `data/course.json` file for v1. This file contains course metadata, chapter order, lesson order, frozen settings, lesson content, quiz data, embed data, and relative asset references.

Each SCO launches the same player and passes a lesson id. The player loads `course.json`, finds the matching lesson, and renders it.

We should not generate one full JSON file per SCO in v1. If package size becomes a problem, we can later split heavy lesson bodies into `data/lessons/{lessonId}.json` while keeping `course.json` as the course index.

## Course Intro

The exported player should show a branded intro overlay on the first actual lesson SCO. The intro is not a separate SCO and should not appear as a fake LMS item.

The overlay should include:

- Course thumbnail
- Course title
- Optional course description
- Configured app logo or Mentingo signet fallback
- Start button

Pressing Start hides the overlay and stores the dismissed state in SCORM suspend data. It must not complete the first lesson by itself.

## Supported Lesson Types

### Content Lessons

Content lessons should render the exported lesson body and bundled resources. Files referenced by the lesson must be copied into the SCORM package and referenced through relative paths.

Videos should use Video.js in v1. The exported runtime should support self-hosted videos and the providers we already use in course content, including Bunny, Vimeo, and YouTube where provider embedding allows it.

### Quiz Lessons

Quiz lessons should render from exported quiz data. The exported package evaluates answers locally and reports completion and score to the LMS.

The package stores learner quiz answers in SCORM runtime state so a learner can resume.

Quiz feedback behavior is frozen from the course settings at export time.

### Embed Lessons

Embed lessons should render configured iframe resources. If an iframe cannot render because the provider blocks embedding, the player should show a link to open the content externally.

## Completion Rules

- Content lesson: complete once viewed.
- Embed lesson: complete once viewed.
- Quiz lesson: complete after learner submits the quiz.

For the first lesson, content/embed completion happens only after the intro overlay has been dismissed and the actual lesson is visible.

Each supported lesson should be its own SCO so the target LMS can track lesson-level progress.

## Acceptance Criteria

- A supported course exports as a valid SCORM 1.2 zip.
- The SCORM manifest shows chapters and lessons in order.
- Each supported lesson launches from the target LMS.
- Content lesson resources load from inside the zip.
- Quiz answers are preserved in resume state.
- Quiz score is reported to the LMS.
- Unsupported lesson types block export with a clear translated error.
- Export does not require the learner to be logged into Mentingo.
