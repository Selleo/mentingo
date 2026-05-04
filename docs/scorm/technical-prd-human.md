# SCORM Technical PRD For Engineers

## Overview

This document describes the technical design for SCORM 1.2 support in Mentingo with a storage model that can support SCORM 2004 later. The first implementation supports SCORM 1.2 package import, launch, runtime commit, and completion mapping.

The repository already has useful foundations:

- `courses -> chapters -> lessons` maps well to SCORM course imports.
- Existing progress rollup can mark chapters and courses complete after lessons complete.
- `courses.isScorm` exists and should be migrated toward an explicit course type.
- `apps/api/src/scorm` already parses `imsmanifest.xml`, extracts files, uploads to S3, stores metadata, and creates chapters/lessons.

The current SCORM code should be refactored, not treated as final. In particular, SCOs should create `scorm` lessons, not ordinary content lessons.

## Schema Design

### Course Type

Add a backend-enforced course type:

- `default`
- `scorm`

Recommended DB shape:

- Add a `course_type` enum or constrained text column.
- Default existing and new regular courses to `default`.
- Backfill `scorm` from existing `courses.is_scorm = true`.
- Keep `is_scorm` temporarily only if generated API compatibility requires it, but treat `course.type` as the source of truth.

### Lesson Type

Extend lesson types with:

- `scorm`

SCORM lessons should render with the SCORM player and should not use the content, quiz, AI mentor, or embed renderers.

### SCORM Package Tables

Add package-level storage. Suggested table: `scorm_packages`.

Fields:

- `id`
- timestamps
- `tenant_id`
- `standard`: `scorm_1_2 | scorm_2004`
- `entity_type`: `course | lesson`
- `entity_id`: the owning course ID or lesson ID, depending on `entity_type`
- `original_file_s3_key`
- `extracted_s3_prefix`
- `manifest_entry_point`
- `manifest_json`
- `status`: at minimum `ready`; optional `processing` and `failed` if import becomes asynchronous

Store both the original ZIP and extracted files. The ZIP is useful for audit/debugging, while extracted files are required for serving SCORM assets with stable paths.

`entity_type` and `entity_id` are a polymorphic owner reference. PostgreSQL cannot enforce this as a normal foreign key, so backend validation must ensure:

- `entity_type = course` points to an existing course.
- `entity_type = lesson` points to an existing lesson.

### SCO Tables

Add SCO-level storage. Suggested table: `scorm_scos`.

Fields:

- `id`
- timestamps
- `tenant_id`
- `package_id`
- `lesson_id`, nullable until linked
- `identifier`
- `identifier_ref`
- `resource_identifier`
- `title`
- `href`
- `launch_path`
- `display_order`
- `parent_identifier`
- `item_metadata_json`
- `resource_metadata_json`

Each SCO should have a stable record. SCORM course import creates one chapter and one lesson per SCO. SCORM lesson import can attach one or many SCOs to the same lesson.

Do not make `scorm_scos.lesson_id` unique. Multi-SCO lesson imports require multiple SCO rows to point to the same Mentingo lesson.

### Runtime Tables

Add attempt storage. Suggested table: `scorm_attempts`.

Fields:

- `id`
- timestamps
- `tenant_id`
- `student_id`
- `course_id`
- `lesson_id`
- `package_id`
- `sco_id`
- `attempt_number`
- `started_at`
- `completed_at`

Add CMI state storage. Suggested table: `scorm_runtime_state`.

Fields:

- `id`
- timestamps
- `tenant_id`
- `attempt_id`
- `completion_status`
- `success_status`
- `score_raw`
- `score_min`
- `score_max`
- `score_scaled`
- `lesson_location`
- `suspend_data`
- `session_time`
- `total_time`
- `progress_measure`
- `entry`
- `exit`
- `raw_cmi_json`

The normalized fields support reporting and progress mapping. `raw_cmi_json` preserves all runtime data for future SCORM 2004 support and debugging.

## Import Behavior

### Shared Validation

Both import modes should:

- Accept a ZIP file.
- Require root-level `imsmanifest.xml`.
- Parse the manifest using structured XML parsing.
- Detect standard from manifest metadata.
- Support only SCORM 1.2 runtime in v1.
- Reject packages without SCO resources.
- Preserve package-relative file paths when extracting to S3.
- Store the original ZIP and extracted files.

### Course Import

Course import should run in a transaction for DB changes.

Flow:

1. Validate and parse package.
2. Create course with `course.type = scorm`.
3. Force course settings so `lessonSequenceEnabled = false`.
4. Create `scorm_packages`.
5. Create `scorm_scos`.
6. For each SCO, create one chapter.
7. In each chapter, create one `scorm` lesson.
8. Link each generated lesson to its SCO.

Course package replacement is not supported. If a SCORM course needs a different package, the admin deletes the course and creates a new one.

### Lesson Import And Replacement

Lesson import is available inside normal courses.

Flow:

1. Validate and parse package.
2. Create a `scorm` lesson in the selected chapter, or replace the selected SCORM lesson.
3. Store package and SCO metadata.
4. Link every SCO in the package to the same Mentingo lesson.

Lesson import supports one or many SCOs. If multiple SCOs are present, the SCORM lesson player uses manifest order and provides simple previous/next navigation inside the lesson.

Lesson replacement follows normal lesson editing semantics:

- If a learner already completed the lesson, that Mentingo completion remains completed.
- Old SCORM CMI state is not migrated into the new package.
- New launches use the new package/SCO runtime state.
- Deleting the SCORM lesson deletes its SCORM package/SCO records by cascade where appropriate.

## Runtime Behavior

Use `scorm-again` in the web player.

For SCORM 1.2:

- Expose `window.API`.
- Use `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, and `LMSFinish`.

For future SCORM 2004:

- Expose `window.API_1484_11`.
- Use `Initialize`, `GetValue`, `SetValue`, `Commit`, and `Terminate`.

The frontend should provide a `useScormPlayer` hook that:

- Fetches launch metadata.
- Creates or resumes an attempt for the current SCO.
- Selects the correct scorm-again API by `scorm_packages.standard`.
- Loads existing CMI state.
- Commits runtime state to the backend.
- Marks the current SCO complete when SCO completion criteria are met.
- Marks the Mentingo lesson complete when all SCOs attached to that lesson are complete.

For multi-SCO lessons, the player should:

- Use manifest `display_order`.
- Open the first incomplete SCO by default.
- Provide previous/next navigation between SCOs.
- Avoid implementing SCORM 2004 sequencing in v1.

## Completion Mapping

For SCORM 1.2, map `cmi.core.lesson_status` to SCO completion.

Complete when:

- `completed`
- `passed`

Do not complete when:

- `incomplete`
- `failed`
- `browsed`
- `not attempted`
- empty or invalid values

When complete:

- Mark the current SCO attempt completed.
- Check whether all SCOs attached to the Mentingo lesson are completed for the student.
- If all attached SCOs are complete, create or update `student_lesson_progress` and set `completedAt`.
- Let existing chapter/course progress rollup handle the rest.

Scores should be stored in SCORM runtime state. Do not treat SCORM scores as quiz attempts in v1 unless explicitly requested later.

## API Surface

Suggested backend endpoints:

- `POST /api/scorm/course/import`
- `POST /api/scorm/lesson/import`
- `POST /api/scorm/lesson/:lessonId/replace`
- `GET /api/scorm/lessons/:lessonId/launch`
- `POST /api/scorm/attempts/:attemptId/commit`
- `GET /api/scorm/packages/:packageId/content?path=...`

Endpoint names can be adapted to existing controller conventions, but the responsibilities should stay separate:

- Import is package/course/lesson creation.
- Launch is read-only metadata and attempt initialization.
- Commit is runtime state persistence.
- Content serving is asset delivery.

## Admin Restrictions

For `course.type = scorm`:

- Hide Curriculum tab in the admin course editor.
- Hide or disable lesson sequence settings.
- Reject backend chapter create/update/delete requests.
- Reject backend lesson create/update/delete requests except during the trusted SCORM import transaction.
- Reject SCORM package replacement.

Backend restrictions are required. UI restrictions alone are not sufficient.

## Asset Serving

SCORM content must be able to find the SCORM API in the parent window and load package assets with original relative paths.

Requirements:

- Preserve extracted file paths exactly relative to package root.
- Serve or proxy assets from a stable LMS-origin URL.
- Handle HTML, JS, CSS, images, fonts, and common binary assets.
- Rewrite relative references only when necessary.
- Avoid breaking package-relative navigation.

## Testing

Backend tests:

- Reject missing `imsmanifest.xml`.
- Reject packages with no SCO.
- Course import creates `course.type = scorm`.
- Course import creates one chapter and one SCORM lesson per SCO.
- Lesson import creates one `scorm` lesson in the requested chapter and can attach one or many SCOs to it.
- SCORM course package replacement is rejected.
- SCORM course curriculum mutations are rejected.
- Runtime commit stores normalized fields and raw CMI JSON.
- `completed` and `passed` complete the current SCO.
- `failed` and `incomplete` do not complete the current SCO.
- A multi-SCO lesson completes only after all attached SCOs complete.

Frontend tests:

- SCORM course admin editor hides Curriculum tab.
- SCORM course settings hides lesson sequence controls.
- SCORM lesson renders the SCORM player.
- `useScormPlayer` commits runtime state.

E2E or integration tests:

- Import a minimal SCORM 1.2 package as course.
- Launch generated SCO lesson.
- Commit completion.
- Verify lesson, chapter, and course progress update.

## Implementation Notes

- Preserve tenant ID handling and existing RLS conventions.
- Prefer existing course/chapter/lesson services where they enforce current invariants, but add trusted import paths where normal admin restrictions would block SCORM course generation.
- Keep import and runtime storage version-neutral.
- Do not name DB columns only after SCORM 1.2 paths if equivalent SCORM 2004 concepts exist.
- Keep raw manifest and raw CMI JSON for support/debugging and future migration.
