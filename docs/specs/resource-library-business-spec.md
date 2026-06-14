# Resource Library Business Spec

## Business Overview

The resource library is Mentingo's reusable asset layer for rich training content. It gives content teams a controlled way to upload files once, reuse them in lessons, news, and articles, and understand where each asset is used before changing or deleting it.

This matters for HR and L&D teams because the same policy document, image, workbook, or video may appear in multiple learning contexts. A central resource library reduces duplicate uploads and makes content maintenance safer.

## Who Uses It

- Course authors adding downloadable files, previews, images, videos, presentations, and documents to lessons.
- News and article managers embedding shared assets in communications.
- Administrators and content owners checking where a file is used before archiving it.
- Learners who open or download assets embedded in learning and communication content.

## Feature Functions

- Upload resource-library assets with title, description, language, optional owner entity, and file metadata.
- Search and filter assets by keyword, type, and language.
- Return paginated asset lists with usage counts.
- Show usages from explicit resource relations and rich-text references.
- Link an existing asset to a rich-text entity.
- Unlink an asset from a rich-text entity.
- Archive an asset and remove related rich-text references.
- Support image, video, PDF, presentation, and document asset types.

## End-User Value

Content teams can keep learning material consistent and easier to maintain. When an asset is reused, administrators can see its impact before removing it. Learners get more reliable content links because asset references are managed centrally instead of being pasted as unmanaged URLs.

## How It Works

The API exposes a resource-library controller for asset listing, usage lookup, linking, unlinking, upload, and deletion. Uploads delegate to the file service and return resource URLs that can be inserted into rich text. The service records relations between assets and supported entities, then scans localized rich-text fields to find additional embedded usages.

On the web side, query and mutation hooks fetch assets and upload new resource-library files through the generated API client. Rich-text upload and replacement utilities use resource IDs and resource URLs so references can be tracked, rewritten, or removed safely.

## Key Technical Context

- Main API implementation: `apps/api/src/resource-library`.
- Main web hooks: `apps/web/app/api/queries/useResourceLibraryAssets.ts` and `apps/web/app/api/mutations/useUploadResourceLibraryAsset.ts`.
- Supported rich-text entity types are lessons, articles, and news.
- Access is granted through resource-library permissions derived from course update, own-course update, article manage, own-article manage, news manage, and own-news manage permissions.
- Asset MIME type support maps to shared resource asset categories for images, videos, PDFs, presentations, and documents.

## Test Evidence

- API E2E covers required authentication and permissions, paginated asset search/filtering, usage counts, usage detail deduplication, unknown-asset 404s, linking and unlinking assets, uploading through `FileService`, and archiving with relation and rich-text cleanup.
- Unit tests cover extracting resource IDs from rich text, deduplicating IDs, removing resource references, replacing resource references, rewriting absolute tenant URLs, and collecting localized rich-text entries.
- Web behavior is currently evidenced through generated hooks and rich-text integration; I did not find a dedicated frontend E2E spec for a standalone resource-library screen.
