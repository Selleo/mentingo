# Knowledge Base Business Spec

## Business Overview

Knowledge Base lets organizations publish structured, multilingual reference content inside the learning platform. Content can be organized into sections, edited as drafts, enriched with media and attachments, and optionally made available to public visitors when tenant settings allow it.

For HR and L&D teams, this creates a maintained reference space for policies, onboarding guidance, learning support, and company knowledge that does not need to be packaged as a course.

## Who Uses It

- HR and L&D administrators who manage knowledge-base structure and access.
- Content creators who write, translate, and update knowledge-base articles.
- Learners and employees who browse published knowledge content.
- Public visitors when unregistered knowledge-base access is enabled.

## Feature Functions

- Organize articles into knowledge-base sections.
- Create, edit, publish, archive, and delete knowledge-base content.
- Manage draft articles separately from published articles.
- Add and remove article or section language versions while preserving base-language rules.
- Upload cover images and rich-text resources such as documents, images, videos, spreadsheets, and presentations.
- Preview rich content before publishing.
- Show published articles through a section table of contents.
- Restrict public access based on tenant settings and article visibility.

## End-User Value

Learners get a central place to find current organizational knowledge in their language. Content teams can maintain guidance without rebuilding courses, while HR and L&D leaders can choose whether selected knowledge should be internal-only or publicly accessible.

## How It Works

Users open the Knowledge Base area and are directed to available published content from the table of contents. Article details show title, summary, author, publish date, cover image, rich content, page table of contents, and previous/next navigation.

Permitted editors can create sections, create draft articles, add translations, upload media, preview content, and publish or archive articles. Public users can access knowledge-base content only when the tenant allows unregistered article access and the article itself is visible in the requested language.

The system keeps base-language and available-language rules explicit so translated content does not silently replace or remove the canonical version.

## Key Technical Context

- Frontend routes include `/articles`, `/articles/:articleId`, and `/articles/:articleId/edit`.
- The implementation currently lives in the Articles module: `apps/web/app/modules/Articles` and `apps/api/src/articles`.
- API endpoints include public list/detail/resource reads plus permission-gated section, draft, edit, language, upload, preview, and delete operations.
- Access is controlled by the Articles feature flag, unregistered article access setting, and `ARTICLE_MANAGE` / `ARTICLE_MANAGE_OWN` permissions.
- Content changes publish activity events for create, update, delete, section, and language-management actions.

## Test Evidence

- API E2E coverage verifies public published visibility, authenticated admin access to private articles, draft restrictions, draft listing, section creation/update, language add/remove, and table-of-contents responses.
- Web E2E coverage verifies article creation with sections, update, delete, public access, role access, list behavior, and opening article details.
