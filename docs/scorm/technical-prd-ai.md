# SCORM Technical PRD For AI Implementation

## Objective

Implement SCORM 1.2 support in Mentingo with a schema that can support SCORM 2004 later. Do not implement SCORM 2004 runtime or sequencing in v1.

The implementation must support:

- Import SCORM as a normal lesson.
- Import SCORM as a course.
- Runtime launch and commit for SCORM 1.2.
- Mentingo lesson completion from SCORM completion status.
- Version-neutral SCORM package, SCO, attempt, and runtime state storage.

## Hard Requirements

- Do not implement SCORM 2004 runtime in v1.
- Do not implement SCORM 2004 sequencing/navigation in v1.
- Do not normalize objectives/interactions into separate reporting tables in v1.
- Do not allow SCORM course package replacement.
- Do allow SCORM lesson replacement and deletion using normal lesson behavior.
- Do preserve completed Mentingo lesson progress if a completed SCORM lesson is replaced.
- Do store original ZIP and extracted package files in S3-compatible storage.
- Do preserve extracted package-relative file paths.
- Do store raw CMI JSON on runtime commits.
- Do block manual curriculum mutation for `course.type = scorm` outside trusted import code.

## Existing Repo Context

Relevant areas:

- API storage schema: `apps/api/src/storage/schema/index.ts`
- Existing SCORM module: `apps/api/src/scorm`
- Course service/controllers/schemas: `apps/api/src/courses`
- Lesson services/types/schemas: `apps/api/src/lesson`
- Student lesson progress: `apps/api/src/studentLessonProgress`
- Admin SCORM UI: `apps/web/app/modules/Admin/Scorm`
- Admin course editor: `apps/web/app/modules/Admin/EditCourse`
- Student lesson player: `apps/web/app/modules/Courses/Lesson`

Existing SCORM code parses manifests and uploads extracted files. Reuse and refactor it, but do not keep mapping SCOs to regular `content` lessons.

## Implementation Sequence

### 1. Shared Constants And Types

Add shared/backend constants for:

- Course types: `default`, `scorm`
- Lesson type: `scorm`
- SCORM standards: `scorm_1_2`, `scorm_2004`
- SCORM package entity types: `course`, `lesson`

Use existing repo patterns for constants and generated API schemas.

### 2. DB Schema And Migration

Add course type:

- Add `courses.type` or equivalent `course_type` column.
- Default to `default`.
- Backfill from `courses.is_scorm`.
- Existing `is_scorm` can remain during transition if generated API or frontend still expects it, but new logic must use course type.

Add SCORM tables:

- `scorm_packages`
- `scorm_scos`
- `scorm_attempts`
- `scorm_runtime_state`

Required package fields:

- tenant ID
- standard
- entity type: `course | lesson`
- entity ID: owning course ID or lesson ID depending on entity type
- original ZIP S3 key
- extracted S3 prefix
- manifest entry point
- manifest JSON
- status

The package owner is polymorphic. Backend code must validate that `entity_id` exists in the correct table for the selected `entity_type`.

Required SCO fields:

- tenant ID
- package ID
- lesson ID nullable
- identifier
- identifier ref
- resource identifier
- title
- href
- launch path
- display order
- parent identifier
- item metadata JSON
- resource metadata JSON

Required attempt fields:

- tenant ID
- student ID
- course ID
- lesson ID
- package ID
- SCO ID
- attempt number
- started at
- completed at

Required runtime state fields:

- tenant ID
- attempt ID
- completion status
- success status
- score raw/min/max/scaled
- lesson location
- suspend data
- session time
- total time
- progress measure
- entry
- exit
- raw CMI JSON

Add indexes for common lookup:

- package by entity type and entity ID
- SCO by package
- attempt by student and lesson
- runtime state by attempt

Do not add a unique constraint on `scorm_scos.lesson_id`. Multi-SCO lesson imports require multiple SCO rows to point to the same lesson. Prefer indexes and uniqueness like:

- index `scorm_packages(entity_type, entity_id)`
- index `scorm_scos(package_id)`
- index `scorm_scos(lesson_id)`
- unique `scorm_scos(package_id, identifier)`

### 3. Manifest Parser Refactor

Refactor current SCORM parsing into reusable functions/services:

- Validate ZIP.
- Find root `imsmanifest.xml`.
- Parse XML with structured parser.
- Detect SCORM standard.
- Extract organizations/items/resources.
- Identify SCO resources.
- Build normalized SCO list with titles, identifiers, resource refs, hrefs, and order.

For v1:

- Accept SCORM 1.2.
- Store SCORM 2004 manifest metadata if detected only if product wants early import detection, but do not launch as supported runtime.
- Reject unsupported runtime launches clearly.

### 4. Course Import Flow

Create a SCORM course import flow:

1. Upload original ZIP to S3.
2. Extract package files to S3 under a stable prefix.
3. Create course with type `scorm`.
4. Force lesson sequence setting to disabled.
5. Create `scorm_packages`.
6. Create one `scorm_scos` row per SCO.
7. For each SCO:
   - Create one chapter.
   - Create one lesson with type `scorm`.
   - Link lesson to SCO.
8. Return created course and package metadata.

Do not support course package replacement. Any replacement request for a SCORM course must fail with a clear validation error.

### 5. Lesson Import And Replacement Flow

Create a SCORM lesson import flow:

1. Upload original ZIP to S3.
2. Extract package files to S3.
3. Create or replace a lesson with type `scorm`.
4. Create package and SCO metadata.
5. Link every SCO in the package to the same lesson.

Lesson import supports one or many SCOs. Multi-SCO lesson import uses the same parser/storage as course import; it only differs in mapping all SCOs to one Mentingo lesson instead of generating one lesson per SCO.

Replacement behavior:

- Treat replacement like normal lesson editing.
- Do not clear existing completed Mentingo `student_lesson_progress`.
- Do not migrate old SCORM runtime state.
- New launches use the new package/SCO.

Deletion behavior:

- Deleting the lesson should remove SCORM package/SCO data by FK/cascade or explicit cleanup consistent with existing deletion patterns.

### 6. Runtime Launch And Commit

Add launch endpoint:

- Input: lesson ID.
- Validate student access using existing lesson access rules.
- Resolve SCORM package and all SCOs for the lesson.
- Select the current SCO:
  - if a SCO ID is provided, launch that SCO after validating it belongs to the lesson.
  - otherwise launch the first incomplete SCO by manifest order.
  - if all SCOs are complete, launch the first SCO by manifest order.
- Create or resume current attempt for the selected SCO.
- Return:
  - standard
  - package ID
  - selected SCO ID
  - ordered SCO list with completion state
  - attempt ID
  - launch URL
  - existing raw CMI JSON
  - normalized runtime state

Add commit endpoint:

- Input: attempt ID and CMI payload.
- Validate student owns attempt.
- Store raw CMI JSON.
- Extract normalized fields.
- For SCORM 1.2, read `cmi.core.lesson_status`.
- If status is `completed` or `passed`, mark the current SCO attempt completed.
- If status is `failed`, `incomplete`, `browsed`, `not attempted`, empty, or invalid, do not mark the SCO complete.
- After completing a SCO, check all SCOs attached to the lesson for the student.
- If all attached SCOs are complete, mark the Mentingo lesson completed.

Do not create quiz attempts from SCORM scores in v1.

### 7. Asset Serving

Expose a stable LMS-origin asset route for extracted package files.

Requirements:

- Preserve package-relative file paths.
- Serve HTML with correct content type.
- Serve JS/CSS/images/fonts/binary files with correct content type.
- Ensure SCORM content can discover the API object in the parent frame.
- Reuse existing asset rewrite/proxy logic if possible, but expand MIME type support beyond only HTML/JS/CSS/JPG/PNG.

### 8. Frontend Player

Install/use `scorm-again` if not already present.

Create a SCORM lesson renderer:

- Student lesson page detects lesson type `scorm`.
- Fetch launch metadata.
- Create scorm-again API instance for SCORM 1.2.
- Attach it to `window.API`.
- Load existing raw CMI state.
- Render package launch URL in an iframe.
- Commit state on SCORM commit calls and before unload where appropriate.
- If the lesson has multiple SCOs, render simple previous/next SCO navigation using the ordered SCO list returned by launch metadata.
- Multi-SCO lesson navigation is Mentingo-controlled and sequential by manifest order. Do not implement SCORM 2004 sequencing/navigation rules in v1.

Recommended hook:

- `useScormPlayer`

Responsibilities:

- Fetch launch metadata.
- Initialize API.
- Load CMI.
- Subscribe to scorm-again commit/value events.
- Persist commits through backend.
- Surface loading/error states.
- Track current SCO and switch iframe launch URL when the student moves previous/next.

### 9. Admin UI

Course type `scorm` behavior:

- Hide Curriculum tab.
- Hide or disable lesson sequence settings.
- Do not show course generation controls.
- Do not show manual chapter/lesson editing.

Lesson-level SCORM behavior:

- Add SCORM as a lesson type in normal curriculum editor.
- Provide upload UI.
- Allow replacement/deletion like other lessons.

### 10. Backend Guards

Backend must enforce SCORM course restrictions.

Block for `course.type = scorm`:

- manual chapter create/update/delete
- manual lesson create/update/delete
- course package replacement
- enabling lesson sequence setting

Allow only trusted SCORM import code to create generated chapters and lessons for SCORM courses.

## Acceptance Checks

A correct implementation satisfies all checks below:

- Importing SCORM as course creates `course.type = scorm`.
- Importing SCORM as course creates one chapter per SCO.
- Every generated chapter contains exactly one `scorm` lesson.
- Generated SCORM lessons link to their `scorm_scos` rows.
- Curriculum tab is hidden for SCORM courses.
- Backend rejects manual curriculum edits for SCORM courses.
- Backend rejects SCORM course package replacement.
- Importing SCORM as lesson creates one `scorm` lesson in the selected chapter.
- A multi-SCO lesson import links all package SCOs to that same lesson.
- Replacing a completed SCORM lesson does not remove existing Mentingo completion.
- Launch endpoint returns attempt ID, launch URL, standard, selected SCO ID, ordered SCO list, package ID, and saved CMI state.
- Commit endpoint stores raw CMI JSON.
- Commit endpoint stores normalized status, score, time, location, and suspend data.
- SCORM 1.2 `completed` marks the current SCO complete.
- SCORM 1.2 `passed` marks the current SCO complete.
- SCORM 1.2 `failed` does not mark the current SCO complete.
- A multi-SCO lesson is marked complete only after all attached SCOs are complete.
- Existing chapter and course progress rollup works after SCORM lesson completion.

## Testing Requirements

Backend tests:

- Valid SCORM 1.2 package import as course.
- Valid single-SCO SCORM 1.2 package import as lesson.
- Valid multi-SCO SCORM 1.2 package import as lesson.
- Missing manifest rejection.
- No-SCO manifest rejection.
- SCORM course curriculum mutation rejection.
- SCORM course replacement rejection.
- SCORM lesson replacement keeps completed progress.
- Runtime commit maps completion correctly.
- Multi-SCO lesson completion waits for all SCOs.

Frontend tests:

- SCORM course editor hides curriculum and sequence controls.
- SCORM lesson player initializes SCORM 1.2 API.
- Runtime commit calls backend.

Integration/E2E:

- Import a small SCORM 1.2 package as course.
- Launch generated lesson.
- Commit `cmi.core.lesson_status = completed`.
- Verify lesson, chapter, and course progress update.

## Implementation Cautions

- Do not bypass tenant ID conventions.
- Do not break existing regular course imports or lesson types.
- Do not couple persistence only to SCORM 1.2 field names.
- Do not delete unrelated learner progress during SCORM lesson replacement.
- Do not rely only on UI hiding for SCORM course restrictions.
- Do not use string manipulation for XML when a parser is available.
- Do not discard raw manifest or raw CMI payloads.
