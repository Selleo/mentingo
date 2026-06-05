# Master Course Resource Copying Plan

## Summary

Improve master-course export and sync so exported courses get independent target-tenant resource files, not just copied resource database rows. Content lesson HTML should point at target-tenant resource URLs, and each copied resource should preserve the source title, description, content type, metadata, and relationship info.

No public API contract changes are expected. This is backend-only inside the existing master-course export and sync worker flow.

The scope is static course authoring structure/content only: course, chapters, lessons, quiz questions/options, static course resources/media, direct media fields, AI mentor context files, SCORM packages required for copied lessons to render, and all authored translations for those entities. Do not copy learner state, runtime state, community data, assignments, or analytics.

## Key Changes

- [x] Update master-course resource sync in `apps/api/src/courses/master-course.service.ts` to copy S3-backed resource files into a target-tenant storage key before inserting target `resources` rows.
- [x] Preserve external non-S3 references as-is for now.
- [x] Copy first-party Bunny/video-provider assets during export instead of sharing source provider references:
  - [x] if the target tenant has Bunny configured, stream-upload copied videos to the target tenant Bunny library
  - [x] if the target tenant uses S3, stream/copy copied videos into target-tenant S3 storage
  - [x] keep external `http://` / `https://` video embeds shared
- [x] Keep current refresh semantics: on each sync, remove existing target lesson/course resource relations, create fresh target resource rows, and recreate relations from the source snapshot.
- [x] Target exported courses should always be created/kept as `draft`, regardless of the source course status.
- [x] Copy direct S3-backed media fields into target-tenant storage too, and store the new target-tenant copied key/reference on the target row:
  - [x] `courses.thumbnailS3Key`
  - [x] `courses.settings.certificateSignature`
  - [x] `lessons.fileS3Key`
  - [x] `questions.photoS3Key`
  - [x] `aiMentorLessons.avatarReference`
  - [x] `aiMentorLessons.customTtsReference` localized entries when they point to S3-backed files
- [x] Exported target courses are always free:
  - [x] set `priceInCents` to `0`
  - [x] keep/set `stripeProductId` and `stripePriceId` to `null`
  - [x] do not copy or create payment-provider state
- [x] Preserve resource info from the source:
  - [x] all localized `title` entries
  - [x] all localized `description` entries
  - [x] `contentType`
  - [x] `metadata`, including original filename, size, checksum, etc.
  - [x] `relationshipType`
  - [x] target `uploadedBy` set to the chosen target author, as today
- [x] Rewrite content lesson rich-text references after target resources are created:
  - [x] replace source resource IDs with target resource IDs
  - replace absolute or relative resource paths with target tenant host URLs using the existing `buildTenantResourceUrl`
  - [x] update `data-resource-id` attributes too
  - [x] run rewriting for every localized lesson description entry, not only the base language
  - [x] use Cheerio for real HTML attribute/node handling, matching the existing `resource-library.utils.ts` approach
- [x] Rewrite fill-in-the-blanks question markers after target answer options are mapped:
  - [x] replace source `<blank-answer-${answerId}>` markers in question descriptions with target answer option IDs
  - [x] cover both `fill_in_the_blanks_text` and `fill_in_the_blanks_dnd`
  - [x] run marker rewriting for every localized question description entry, not only the base language
  - [x] preserve legacy `[word]` fallback behavior by only rewriting explicit blank-answer markers
  - use a narrow token/regex replacement for `<blank-answer-${answerId}>`, not Cheerio, because the marker is custom placeholder syntax rather than normal HTML
- [x] Include both lesson resources and course resources, matching the existing snapshot shape. Only lesson rich-text content needs URL rewriting.
- [x] Include SCORM package content for SCORM lessons so exported SCORM lessons remain playable in target tenants.

## Implementation Details

- [x] Implement sync in explicit batches so each layer has stable target IDs before dependent data is copied:
  1. Course shell and category:
     - [x] resolve/create/update target category by source base-language title
     - [x] create/update target course
     - [x] force `status = draft`, `priceInCents = 0`, `stripeProductId = null`, `stripePriceId = null`
     - [x] copy course-level direct media, including thumbnail and certificate signature, then write the copied target keys
     - [x] copy all course/category translations
     - [x] upsert course mappings
  2. Chapters:
     - [x] create/update chapters from source
     - [x] copy all localized titles
     - [x] upsert source chapter to target chapter mappings
     - [x] clean up removed mapped chapters
  3. Lessons:
     - [x] create/update lessons using the chapter map
     - [x] copy all localized lesson fields
     - [x] copy direct lesson media such as `fileS3Key`, then write the copied target key
     - [x] upsert lesson mappings
     - [x] keep live-training deep-copy behavior out of scope
  4. Quiz questions/options:
     - [x] create/update questions using the lesson map
     - [x] copy all localized question fields and direct question images
     - [x] create/update options using the question map
     - [x] return an option map
     - [x] rewrite fill-in-the-blanks markers in every localized question description
  5. Resources:
     - [x] copy resource-library rows/files for lesson and course resources
     - [x] recreate target relations
     - [x] build resource ID maps
     - [x] rewrite resource URLs and `data-resource-id` in every localized lesson description
  6. AI mentor:
     - [x] create/update AI mentor lesson data using the lesson map
     - [x] copy avatar/custom voice S3 refs
     - [x] copy linked context documents, chunks, embeddings, and document links
     - [x] exclude threads, messages, learner progress, and scores
  7. SCORM:
     - [x] copy package rows for SCORM lessons
     - [x] copy SCO rows using the lesson map
     - [x] copy original package file
     - [x] recursively copy extracted package prefix/folder
     - [x] exclude attempts and runtime state
  8. Cleanup/finalization:
     - [x] remove target entities whose source mappings disappeared
     - clean up old copied resources/media/SCORM objects where safe
     - [x] update chapter counts and sync status
     - [x] mark export success/failure
- [x] Inject or otherwise expose a repo-native storage-copy helper to master-course sync, using existing `S3Service.copyFile`.
- [x] Copy localized JSONB fields wholesale for authored structure/content instead of rebuilding only the source base-language entry:
  - [x] course `title`, `description`
  - [x] chapter `title`
  - [x] lesson `title`, `description`
  - [x] question `title`, `description`, `solutionExplanation`
  - [x] answer option `optionText`, `matchedWord`
  - [x] resource `title`, `description`
  - [x] category `title` when creating or syncing target categories
- [x] Add a small helper for deriving target copy keys:
  - [x] keep the original extension/basename where possible
  - [x] prefix with the target tenant ID
  - [x] place copied resources under a deterministic master-course/export folder
- [x] Detect copyable S3 references by excluding:
  - [x] `http://` / `https://`
  - [x] empty/null references
  - [x] `bunny-` provider references
- [x] For copyable S3 references:
  - [x] copy `sourceResource.reference` to the new target key
  - [x] insert the target `resources.reference` as the copied target key
- [x] For non-copyable references:
  - [x] insert the original reference unchanged
- [x] Add Bunny/video-provider copy handling for copied content/direct media references:
  - [x] do not keep source `bunny-*` IDs when the asset is first-party stored media
  - [x] create target-tenant Bunny IDs when Bunny is configured for the target tenant
  - [x] create target-tenant S3 keys when Bunny is not configured for the target tenant
  - [x] leave external URL embeds unchanged
- [x] Keep the existing `lessonResourceMap` behavior, but ensure it maps every copied lesson resource source ID to the new target resource ID before calling `syncLessonResourceReferences`.
- [x] Change option sync to return an `optionMap` of source answer option ID to target answer option ID.
- [x] Add a helper for question-description marker rewriting, using the current marker format `<blank-answer-${answerId}>`.
- [x] Keep the HTML rewriting strategies separate:
  - [x] Cheerio for resource URLs and attributes (`href`, `src`, `data-src`, `data-resource-id`)
  - regex/token replacement for blank-answer markers using UUID-only matching
- [x] After `syncOptions`, update mapped target question descriptions for fill-in-the-blanks questions:
  - [x] read all localized source question description entries
  - [x] replace marker answer IDs through `optionMap` per locale
  - [x] write the rewritten localized description map to the target question
- [x] Keep question/option entity mapping as the source of truth; do not infer target option IDs by display order when explicit markers exist.
- [x] Add a separate SCORM sync step after course and lesson IDs are mapped:
  - [x] copy `scorm_packages` rows for source course/lesson packages that belong to exported SCORM lessons
  - [x] remap package `entityId` to the target course or target lesson as appropriate
  - [x] copy `scorm_scos` rows and remap `lessonId` to the target lesson
  - [x] copy S3-backed `originalFileReference` into target-tenant storage
  - [x] copy the entire S3 prefix/folder referenced by `extractedFilesReference` into target-tenant storage, not just a single object
  - [x] preserve package `language`, `standard`, `manifestEntryPoint`, `manifestJson`, and `status`
  - [x] do not copy SCORM attempts, runtime state, or learner progress
- [x] Add a separate AI mentor context sync step after AI mentor lesson IDs are mapped:
  - [x] copy `documents` linked through `document_to_ai_mentor_lesson`
  - [x] copy `doc_chunks` for copied documents so RAG context works in the target tenant without re-ingestion
  - [x] remap `document_to_ai_mentor_lesson.aiMentorLessonId` to the target AI mentor lesson
  - [x] preserve document file name, content type, byte size, checksum, status, error message, metadata, chunk content, chunk metadata, and embeddings
  - [x] do not copy AI mentor threads, messages, progress, scores, or learner interactions

## Tests

- [x] Extend `apps/api/src/courses/__tests__/master-course.e2e-spec.ts`.
- [x] Mock the storage-copy dependency so tests do not hit real S3.
- Add coverage for:
  - [x] exporting a content lesson with an attached resource referenced in rich text
  - [x] target tenant gets a new `resources` row with preserved metadata/title/description/contentType
  - [x] target `resources.reference` differs from the source for S3-backed files and is target-tenant-prefixed
  - [x] copy helper is called with source key, target key, and content type
  - [x] target lesson description uses target tenant base URL and target resource ID
  - [x] `data-resource-id` is rewritten to the target resource ID
  - course-level resources are copied and related to the exported course
  - non-S3 references are preserved without invoking S3 copy
  - [x] fill-in-the-blanks text question descriptions rewrite `<blank-answer-sourceOptionId>` to `<blank-answer-targetOptionId>`
  - fill-in-the-blanks drag-and-drop question descriptions rewrite the same marker format
  - legacy `[word]` descriptions continue to sync without marker rewriting
  - SCORM lesson export creates target `scorm_packages` and `scorm_scos` linked to mapped target lessons
  - target SCORM package references point to target-tenant copied storage keys
  - SCORM extracted package folder/prefix is copied recursively
  - SCORM attempts/runtime state are not copied
  - direct media fields point to target-tenant copied storage keys
  - [x] copied target course preserves localized course title/description entries
  - [x] copied target course preserves localized category title entries
  - [x] copied target chapter preserves localized title, target course, target author, freemium flag, order, and lesson count
  - [x] exported target courses are free and have no Stripe product/price IDs
  - [x] exported target courses are draft even when the source course is published
- [x] Bunny/video-provider assets are copied to target Bunny/S3 and target content references are rewritten to the copied target resource IDs
  - AI mentor context documents/chunks/links are copied to the target AI mentor lesson
- Run focused validation:
  - [x] `pnpm --filter=api test:e2e -- master-course.e2e-spec.ts`
  - [x] `pnpm --filter=api lint-tsc`

## Additional Caution Areas

- Allow exporting SCORM courses through master-course sharing. SCORM course-type/source courses should be eligible for tenant export, not only regular courses with SCORM lessons.
- Make initial export status atomic:
  - create/update export links as `pending` when the share is queued
  - do not mark the source course as shared/master until the export worker finishes successfully
  - only mark the export as `shared` after the target course, chapters, lessons, resources, AI mentor context, and SCORM package copy all succeed
  - failed exports should remain failed and must not appear as successfully shared
- Add master-course export progress notifications:
  - track progress percentage during the worker sync
  - publish progress over the authenticated user socket room
  - return from the export request immediately after queueing, with status `pending`
  - reuse the existing global upload/progress popup pattern so users see sharing progress and completion/failure
  - invalidate master-course export/candidate queries when progress completes or fails
- Decide and implement master-tenant update propagation:
  - updating a course in the master/source tenant should sync that change to all exported target tenants
  - define which source-side mutations trigger sync automatically
  - decide whether to use existing course/chapter/lesson events, explicit master-course sync queueing, or a broader outbox/domain-event approach
  - keep propagation async through workers so source-tenant editing is not blocked by target-tenant sync
- [x] Direct course-content file references are separate from `resources` and must be copied too; target rows should receive the copied target-tenant key/reference, not the original source key:
  - [x] `courses.thumbnailS3Key`
  - [x] `courses.settings.certificateSignature`
  - [x] `lessons.fileS3Key`
  - [x] `questions.photoS3Key`
  - [x] `aiMentorLessons.avatarReference`
  - [x] `aiMentorLessons.customTtsReference` localized entries when S3-backed
- [x] Multi-language content is in scope. Current master-course sync primarily reads and rewrites the source course base language while still copying `availableLocales`; update it so all localized fields are copied, and resource URL / blank-answer marker rewriting iterates every localized rich-text entry.
- Repeated syncs must not leak target resources or S3 objects. Current code removes `resource_entity` rows but creates new `resources` rows each sync; once file copying is added, cleanup should archive/delete prior mirrored resources and copied files, or reuse stable resource mappings.
- [x] Deduplicate copied resources within a sync. If the same source resource is linked from multiple lessons or course contexts, copy/create it once per target export and create multiple target relations as needed.
- [x] S3 copy is not transactionally tied to DB writes. Generate deterministic target keys and make the copy/create flow idempotent enough that failed retries do not leave confusing duplicate files or broken references.
- [x] AI mentor lesson context files are not normal `resources`; they live in `documents`, `doc_chunks`, and `document_to_ai_mentor_lesson`. Exported AI mentor lessons may lose RAG context unless this is handled separately.
- [x] AI mentor lesson context files are in scope. They live in `documents`, `doc_chunks`, and `document_to_ai_mentor_lesson`, not normal `resources`, and must be copied separately from resource-library assets.
- [x] SCORM lessons are in scope and require separate package data/files (`scorm_packages`, `scorm_scos`, extracted package references). A plain lesson row copy is not enough for working SCORM content.
- [x] Live training lesson deep-copying is intentionally out of scope. Do not copy calendar/live-training/link/session/material data for master-course sharing in this iteration.
- Sync trigger coverage needs review. The current master sync handler listens to course/chapter/lesson events; resource-library changes, SCORM import/replace operations, AI mentor document ingestion changes, and direct media updates may need to emit an existing course/lesson update event or explicitly queue master sync.
- Learning path export uses `MasterCourseService.ensureCourseExportSynced`, so any course-sharing copy gap also affects shared learning paths that include master courses.
- [x] Keep exported-course provenance available on detailed course fetches used by learning-path export validation (`sourceCourseId`, `sourceTenantId` on `beta-course-by-id`).
- Course creation side effects need review because master sync inserts target courses directly instead of using the normal course creation service. Confirm expected behavior for:
  - `shortId` and `course_slugs` generation; lazy slug generation may be acceptable, but target courses must still resolve by slug after export
  - `courses_summary_stats`, which is already created explicitly
  - Stripe product/price creation, which is intentionally not copied; paid exported courses may have `priceInCents` without target `stripeProductId`/`stripePriceId`
- [x] Category translations should be copied too. Category matching may still be title-based, but when creating/updating the target category for a master course, preserve all source category localized `title` entries, `baseLanguage`, and `availableLocales` where possible.
- Category sync must respect the existing unique index on `tenant_id + (title ->> base_language)`:
  - add category to master-course entity mapping so categories created by an export can be updated on later syncs
  - if a mapped target category exists, update it from the source category only when the source base-language title does not conflict with another target category
  - if there is no mapping, reuse an existing target category with the same base-language title instead of creating a duplicate
  - if a mapped category update would conflict with another existing category, assign the target course to the existing matching category and update the mapping to that category; do not overwrite the unrelated category's translations
  - copy all source category translations only when creating a new target category or updating a category owned by the export mapping
- [x] Course pricing is intentionally reset for exported target courses. Target copies should always be free (`priceInCents = 0`) and should never copy/create Stripe product or price IDs.
- Archive state for categories/resources is tenant-local. Archiving a category or resource in one tenant should only affect that tenant; do not propagate archive actions from source to target or target to source as part of master-course sync.
- [x] Do not copy anything outside static course authoring structure/content. Specifically exclude learner/community/runtime state:
  - [x] enrollments and `group_courses`
  - [x] certificates
  - [x] quiz attempts and student answers
  - [x] lesson/chapter/course progress and learning time
  - [x] course chat threads/messages/reactions
  - [x] statistics tables
- Keep readonly semantics intact for exported courses. Resource-library actions, lesson media actions, and sync cleanup should not create a path for target tenants to mutate exported course content outside the master sync.

## Assumptions

- "Copied over" means physical S3 object copy for S3-backed resources, provider-aware Bunny/S3 streaming copy for first-party stored videos, plus duplicated resource DB records.
- External URLs remain shared because there is no generic provider-independent copy behavior. First-party Bunny/video provider assets are copied to the target tenant provider/storage.
- Sync should refresh target resources from the master source each time, matching the current delete/recreate relation behavior.
- No migration is needed because existing `resources` and `resource_entity` tables already store the required info.
- Live-training lessons are excluded from the resource/media copy work for now; exported copies may keep only the generic lesson shell behavior already supported by the current implementation.
