# Assets Library for RichText Resources

## Summary

Add a tenant-scoped RichText assets library as a dialog opened from the existing RichText toolbar. It lists paginated RichText assets, lets users upload and immediately insert a new asset, lets users insert an existing asset, and supports destructive deletion after showing all known usages. Deletion removes matching RichText embeds/links from affected content and archives the resource.

## Phases

### Phase 1: Backend asset library API - Done

- Done: Added a `resource-library` API module using `BaseResponse` / `PaginatedResponse`.
- Done: Scoped library results to RichText attachment/content resources only, excluding unrelated resource usages.
- Done: Added backend endpoints:
  - `GET /resource-library/assets?page&perPage&search&type&language` for paginated assets.
  - `GET /resource-library/assets/:id/usages` for lesson/article/news usages.
  - `POST /resource-library/assets/:id/link` to link an existing resource to a target entity.
  - `POST /resource-library/assets/upload` for upload-and-insert backend flow.
  - `DELETE /resource-library/assets/:id` to remove resource links and archive the resource.
- Done: Asset list returns `id`, localized/display file name, `contentType`, type, size/original filename, created date, uploader, reference, and usage count.
- Done: Used existing `resources` and `resource_entity`; no schema migration or new table was added.
- Remaining: Generated API schema/client and tests are still tracked in Phase 5.

### Phase 2: RichText usage tracking and deletion cleanup - Done

- Done: Existing asset insertion uses the resource-library link endpoint to create a `resource_entity` relation for the current entity and relationship type.
- Done: Usage lookup now includes both `resource_entity` relations and direct RichText content references.
- Done: Deletion cleanup removes matching Tiptap nodes/HTML anchors from lesson/article/news localized content fields before deleting relations and archiving the resource.
- Done: Cleanup matches resource IDs in `lesson-resource/:id`, `articles-resource/:id`, `news-resource/:id`, `data-resource-id`, `href`, `src`, and `data-src`.
- Done: Deletion DB updates are transactional; physical object deletion from S3/MinIO remains out of scope.

### Phase 3: Web dialog and RichText integration

- Add an "Assets library" action to `EditorToolbar` next to the current upload button.
- Build `AssetLibraryDialog` using existing dialog, pagination, file upload, toast, and generated API client patterns.
- Dialog behavior:
  - List paginated assets with file-type icon, filename, type label, upload date, and usage count.
  - Search by filename/title.
  - Select asset inserts it into the current editor using the same embed rules as uploads: presentation preview/download prompt, PDF preview/download prompt, documents as downloadable files, fallback link for other files.
  - Upload from the dialog uploads the asset and inserts it immediately.
  - Delete opens a confirmation view showing usages before destructive action.
- Add i18n strings for English and Lithuanian.

### Phase 4: Course export / sync safety

- Extend master course export resource sync so RichText assets are copied into target tenants and content references point to target resource IDs.
- Use existing `MASTER_COURSE_ENTITY_TYPES.RESOURCE` / `RESOURCE_ENTITY` mapping support instead of creating duplicate target resources on every sync.
- During export/sync:
  - Copy each source resource once per export link.
  - Map source resource ID to target resource ID.
  - Rewrite lesson RichText content from source resource URLs/IDs to target resource URLs/IDs.
  - Prefer tenant-relative `/api/lesson/lesson-resource/:targetId` style URLs in rewritten content to avoid leaking source tenant hostnames.
- Preserve existing course/lesson/chapter/question sync behavior.

### Phase 5: Generated client and validation

- Regenerate API schema and web client only through existing scripts after API endpoints are added.
- Add API tests for:
  - Paginated RichText-only listing.
  - Linking an existing resource to another entity.
  - Usage lookup across lessons/articles/news.
  - Delete removes RichText references and archives resource.
  - Master course export copies resources and rewrites content to target resource IDs.
- Add web tests or focused component coverage for:
  - Dialog pagination and rendering file icons/names.
  - Upload-and-insert.
  - Insert existing asset.
  - Delete confirmation with usages.

## Assumptions

- Asset library scope is RichText resources only.
- Uploading from the dialog immediately inserts the uploaded asset into the active editor.
- Deleting a used asset removes embeds/links from affected RichText content instead of leaving broken placeholders.
- Physical file deletion from object storage is deferred unless existing infrastructure already supports safe cleanup.
