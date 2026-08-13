# Resource Library Business Spec

## Business Overview

Resource Library is Mentingo's reusable asset workflow for rich training and communication content. It lets authors upload files into a shared library from the rich-text editor, reuse existing assets, control whether their own assets are public or private, and check where an asset is used before deleting it.

This matters for HR and L&D teams because the same policy PDF, workbook, image, presentation, or video may appear in multiple lessons, news posts, or articles. A managed library reduces duplicate uploads and makes asset maintenance safer.

The feature is not a standalone learner page. It appears inside authoring flows where content teams work with rich text and supporting files.

## Who Uses It

- Course authors reuse documents, images, presentations, and videos while building lesson content.
- News and article managers insert existing assets into rich communication content.
- Content administrators review asset usage before deleting a shared file.
- Learners benefit indirectly because embedded resources stay consistent across lessons, articles, and news.

## Feature Functions

- Open an asset-library dialog from rich-text authoring contexts.
- Search and paginate existing assets for the current authoring language.
- Upload a supported file into the library from the editor workflow.
- Choose one public or private visibility for every batch dropped directly into a rich-text editor.
- Keep personal assets private so other creators cannot discover or reuse them, while retaining delivery through the content where they are embedded.
- Change visibility for one or several eligible assets at once, with warnings when used assets become private.
- Insert a selected asset into rich text using the right preview or display mode.
- Track where assets are linked or embedded across supported rich-text entities.
- Show usage details before deletion so authors understand the impact.
- Delete an asset and remove related rich-text references.
- Support image, video, PDF, presentation, spreadsheet, and document uploads.

## End-User Value

Resource Library helps content teams keep training materials consistent and easier to maintain while giving authors control over personal working materials. Authors can reuse approved public assets instead of uploading duplicates, keep private assets out of other creators' libraries, and administrators can see the impact of deletion before removing a resource that may appear in several learning or communication contexts.

## How It Works

An author opens the asset-library dialog from a rich-text editor while editing a lesson, article, or news post. Mentingo lists reusable assets for the current language, supports search and pagination, and lets the author insert an existing asset into the editor.

If the needed file is not already available, the author can upload it from the dialog. Library uploads are public by default. The uploader can later make their own asset private or return it to public, while administrators can manage visibility for any eligible asset. Private assets remain available to learners or readers through the lesson, article, or news item where they were placed, but are not shown to other creators in the Asset Library.

When files are dragged into a rich-text editor, Mentingo asks the author to choose whether the entire dropped batch is public or private before uploading it. The choice applies consistently to images, documents, presentations, and videos.

Shared-course resource copies use a separate hidden state in the receiving tenant. They keep the shared course working but never appear in that tenant's Asset Library, including for administrators.

When deleting an asset, Mentingo shows where it is used and asks for confirmation. Confirmed deletion archives the asset, removes explicit relations, and cleans up rich-text references so authors are not left with unmanaged links.

## Key Technical Context

- The rich-text dialog is implemented in `apps/web/app/components/RichText/components/AssetLibraryDialog.tsx`.
- The Resource Library API lives in `apps/api/src/resource-library` and supports visibility-aware listing, usage lookup, linking, unlinking, upload, visibility changes, and deletion.
- Supported rich-text entity types are lessons, articles, and news.
- Access is granted through content-management permissions for courses, articles, and news via `RESOURCE_LIBRARY_PERMISSIONS`. `RESOURCE_LIBRARY_MANAGE` is a separate administrative override for private assets; it is granted to the Admin default role and can be granted to custom roles.
- Resource utilities scan localized rich-text content for resource IDs, deduplicate usages, replace resource references, and remove references during deletion.

## Test Evidence

Existing backend E2E coverage verifies required authentication and permissions, paginated asset search/filtering, usage counts, usage detail deduplication, unknown-asset 404s, linking and unlinking assets, uploading through the file service, and deletion cleanup. The visibility implementation adds API and UI behavior that should receive focused E2E coverage for uploader/admin filtering, bulk updates, and hidden shared-course copies. Unit tests cover resource-ID extraction, deduplication, reference removal and replacement, tenant URL rewriting, and localized rich-text entry collection.
