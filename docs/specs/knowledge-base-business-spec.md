# Knowledge Base Business Spec

## Business Overview

Knowledge Base lets organizations publish structured reference content inside Mentingo. Articles can be organized into sections, maintained in multiple languages, enriched with media and attachments, edited as drafts, and optionally exposed to public visitors when tenant settings allow it.

For HR and L&D teams, this creates a maintained reference space for policies, onboarding guidance, learning support, and company knowledge that does not need to be packaged as a course.

The main workflow starts from the Articles area. Readers browse the table of contents and open published articles, while permitted editors create sections, draft articles, edit rich content, preview changes, publish updates, and delete outdated content.

## Who Uses It

- HR and L&D administrators publish policies, onboarding guidance, and learning support articles.
- Content creators write, translate, preview, and update knowledge-base articles.
- Learners and employees browse published articles in their selected language.
- Public visitors read allowed articles when unregistered article access is enabled.

## Feature Functions

- Organize articles into knowledge-base sections.
- Create draft articles from the table of contents.
- Edit article title, summary, cover image, and rich-text content.
- Upload article resources such as documents, images, videos, spreadsheets, and presentations.
- Preview rich content before saving changes.
- Add or remove article and section language versions.
- Show published articles with author, publish date, cover image, page table of contents, and previous/next navigation.
- Restrict article access based on tenant public-access settings, article visibility, draft mode, and article permissions.

## End-User Value

Learners and employees get a central place to find current organizational knowledge in their language. HR and L&D teams can maintain reference material without turning every policy or support page into a course.

Public access controls let organizations decide when selected knowledge should support external audiences, while draft and permission rules keep unfinished or internal-only content protected.

## How It Works

Readers open the Articles area and are directed to available published content from the table of contents. Article detail pages show the article content, author, publish date, cover image, in-page navigation, and previous/next article links.

Editors with article permissions can create sections and draft articles, edit localized article content, upload resources into rich text, preview rendered content, and delete articles or sections. Language selectors keep base-language and available-language behavior explicit so translations do not silently replace the canonical version.

Public visitors can reach articles only when tenant settings allow unregistered article access and the article is visible in the requested language. Authenticated admins can access private or draft content according to their permissions.

## Key Technical Context

- Frontend routes include `/articles`, `/articles/:articleId`, and `/articles/:articleId/edit`.
- The implementation currently lives in the Articles module: `apps/web/app/modules/Articles` and `apps/api/src/articles`.
- Articles are gated by the Articles feature/access settings plus `PERMISSIONS.ARTICLE_MANAGE` and `PERMISSIONS.ARTICLE_MANAGE_OWN` for editor actions.
- Public list/detail/resource endpoints support reader access, while draft, section, edit, language, upload, preview, and delete operations are permission-gated.
- Article resources reuse the platform's file and rich-text upload handling.

## Test Evidence

- Web E2E coverage verifies article creation with sections, browsing the article list, opening article details, updating articles, deleting articles, public access behavior, and role-based access.
- API E2E coverage verifies public published visibility, authenticated admin access to private articles, draft restrictions, draft listing, section creation and update, section language add/remove, and table-of-contents responses.
