# SCORM 1.2 Support PRD

## Overview

Mentingo needs to support SCORM 1.2 content imports while keeping the product and data model ready for SCORM 2004 later. The first release focuses on reliable import, launch, completion tracking, and score/runtime persistence for SCORM 1.2.

SCORM content can be imported in two ways:

- As a lesson inside a normal Mentingo course.
- As a full SCORM course, where each SCO becomes its own chapter with one SCORM lesson.

SCORM 2004 runtime, sequencing, navigation rules, and detailed interaction analytics are out of scope for the first release.

## Goals

- Allow admins to import a SCORM package as a single lesson.
- Allow admins to import a SCORM package as a course.
- Track student completion for SCORM lessons using Mentingo's existing lesson/chapter/course progress model.
- Store SCORM runtime state so learners can resume where supported by the package.
- Store enough version-neutral SCORM data to add SCORM 2004 later without redesigning persistence.
- Keep SCORM course curriculum locked because its structure comes from the SCORM manifest.

## Non-Goals

- No SCORM 2004 runtime support in v1.
- No SCORM 2004 sequencing/navigation implementation in v1.
- No detailed normalized analytics for SCORM objectives or interactions in v1.
- No SCORM package replacement for SCORM courses.
- No editing individual SCORM course chapters or lessons after import.

## Product Model

### SCORM Lesson Import

An admin can import a SCORM package into an existing course as a lesson.

Expected behavior:

- The course remains a normal Mentingo course.
- A new lesson type, `scorm`, is available.
- The SCORM lesson appears in the selected chapter like other lessons.
- The student launches the SCORM package from the lesson page.
- A lesson-level SCORM package can contain one or many SCOs.
- If the package contains one SCO, the lesson launches that SCO directly.
- If the package contains multiple SCOs, the lesson player uses the manifest order and lets the student move between SCOs inside the same Mentingo lesson.
- The lesson is completed when all SCOs attached to the lesson are completed.
- If the SCORM lesson is deleted, it is gone like any other lesson.
- If the SCORM lesson is replaced after a learner has already completed it, the existing Mentingo completion remains completed.
- New SCORM runtime state belongs to the new uploaded package. Old SCORM CMI state is not migrated.

### SCORM Course Import

An admin can import a SCORM package as a new course.

Expected behavior:

- The course is created with type `scorm`.
- Each SCO in the SCORM manifest becomes one chapter.
- Each generated chapter contains one SCORM lesson.
- Completing the SCO completes the generated lesson.
- Completing the generated lesson completes the chapter automatically through existing Mentingo progress rollup.
- Completing all generated chapters completes the course through existing Mentingo course completion logic.

SCORM course content is locked after import:

- The Curriculum tab is hidden.
- Lesson sequence settings are hidden or disabled.
- Manual chapter and lesson edits are blocked by the backend.
- Package replacement is blocked. If an admin wants a different SCORM package, they must delete the SCORM course and create a new one.

## User Flows

### Admin Imports SCORM As Course

1. Admin starts SCORM course creation.
2. Admin uploads a SCORM ZIP package.
3. System validates that the package has a root `imsmanifest.xml`.
4. System validates that the manifest contains at least one SCO.
5. Admin fills course details, pricing, and status.
6. System stores the original ZIP and extracted package files.
7. System creates a SCORM course.
8. System creates one chapter and one SCORM lesson for each SCO.
9. Admin can manage status, pricing, enrollment, and settings that are not curriculum-specific.

### Admin Imports SCORM As Lesson

1. Admin opens the curriculum editor of a normal course.
2. Admin creates or replaces a SCORM lesson in a chapter.
3. System validates the SCORM ZIP package.
4. System stores the original ZIP and extracted package files.
5. System creates or updates one SCORM lesson.
6. System attaches all package SCOs to that one lesson.
7. Existing Mentingo progress follows normal lesson behavior.

### Student Takes SCORM Lesson

1. Student opens a SCORM lesson.
2. System starts or resumes a SCORM attempt for the current SCO.
3. The SCORM content runs inside the Mentingo lesson player.
4. Runtime state is committed to Mentingo per SCO.
5. If the lesson has multiple SCOs, the player opens the first incomplete SCO by default and provides simple previous/next navigation in manifest order.
6. When a SCO reports `completed` or `passed`, Mentingo marks that SCO complete.
7. When all SCOs attached to the lesson are complete, Mentingo marks the lesson complete.
8. Existing chapter and course progress updates continue to work through current progress logic.

## Completion Rules

For SCORM 1.2, SCO completion is based on `cmi.core.lesson_status`.

Statuses that complete the SCO:

- `completed`
- `passed`

Statuses that do not complete the SCO:

- `incomplete`
- `failed`
- `browsed`
- `not attempted`
- missing or invalid status

Mentingo lesson completion is derived from SCO completion:

- In SCORM course imports, each generated lesson usually has one SCO, so completing that SCO completes the lesson.
- In SCORM lesson imports, a lesson can have one or many SCOs, so the lesson completes only when all SCOs attached to that lesson are complete.

SCORM scores are stored in SCORM runtime storage. They should not be treated as quiz results unless a separate product decision is made.

## SCORM 2004 Readiness

The first release stores version-neutral runtime fields and raw CMI JSON so SCORM 2004 can be added later.

Important differences to account for:

- SCORM 1.2 has one combined status field: `cmi.core.lesson_status`.
- SCORM 2004 separates status into `cmi.completion_status` and `cmi.success_status`.
- SCORM 2004 adds richer progress fields such as `cmi.progress_measure`.
- SCORM 2004 can include sequencing and navigation requests.

The v1 product should preserve manifest hierarchy and raw runtime data, but it should not implement 2004 sequencing.

## Acceptance Criteria

- Admin can import a valid SCORM 1.2 package as a lesson.
- Admin can import a valid SCORM 1.2 package as a course.
- Invalid packages without `imsmanifest.xml` are rejected.
- Packages without SCOs are rejected.
- SCORM course import creates one chapter and one SCORM lesson per SCO.
- SCORM lesson import accepts one or many SCOs and keeps them inside one Mentingo lesson.
- SCORM course curriculum editing is hidden in the UI and blocked in the backend.
- SCORM course package replacement is not available.
- SCORM lesson replacement is allowed and follows normal lesson editing semantics.
- Multi-SCO lessons mark the Mentingo lesson complete only after all attached SCOs complete.
- Student SCORM runtime state is committed and can be resumed.
- SCORM `completed` and `passed` statuses mark the current SCO completed.
- SCORM `failed` does not mark the current SCO completed.
