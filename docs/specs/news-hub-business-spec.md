# News Hub Business Spec

## Business Overview

The News Hub gives HR, L&D, and internal communications teams a governed place to publish company and learning updates inside Mentingo. It turns ad hoc messages into structured news posts that learners can browse, open, and return to later.

The feature supports both everyday learner communication and editorial work. Learners see published news in their current interface language, while authorized news managers can create drafts, prepare localized versions, add rich content, and decide whether a published item can also be read by public visitors.

For HR and L&D, the value is consistency: policy updates, program announcements, platform changes, or training-related messages can live in the same learning environment where employees already complete courses and check announcements.

## Who Uses It

- HR and L&D administrators publish learning-program updates, policy notices, or internal communications that should be visible in the learner portal.
- Content managers prepare drafts, enrich posts with images or embedded resources, and review the post before publishing.
- Learners browse current news, open full articles, and move between related posts without leaving Mentingo.
- Public visitors can read selected published posts when the tenant allows public News access and the specific post is marked public.

## Feature Functions

- Browse published news in a paginated News Hub.
- Open a news detail page with title, summary, cover image, author, publication date, rich content, table of contents, and previous or next navigation.
- Create draft news posts from the News page.
- Edit title, summary, content, status, visibility, and cover image before publishing.
- Manage localized news versions so different audiences can read the same update in their selected language.
- Upload and embed supporting files, images, and videos in rich news content.
- Preview rich content before publishing.
- Limit draft, edit, delete, and public-read behavior through tenant settings, post visibility, publication status, and news permissions.

## End-User Value

News Hub gives learners a clear source for organizational and learning-related updates, while HR and L&D teams get a controlled publishing workflow instead of scattered messages. Multilingual content improves reach across international teams, and public/private visibility helps teams reuse Mentingo news for external-facing updates when appropriate.

## How It Works

A news manager opens the News page, creates an empty draft, and fills in the post in the News form. The form supports a cover image, title, summary, rich content, publication status, public visibility, and language selection. Managers can preview the rich content before saving and can return later to update or delete the post.

Learners and visitors open the News page to see published items. The list highlights the first item on the first page, paginates the rest, and opens each post into a detailed article view. On the detail page, Mentingo renders the localized content, supporting media, article metadata, table of contents, and previous/next post navigation.

Drafts are visible only to users who can manage news. Public visitors can access the News Hub only when public News access is enabled for the tenant and the post itself is published and public.

## Key Technical Context

- The user-facing web routes are `/news`, `/news/:newsId`, `/news/add`, and `/news/:newsId/edit`, implemented under `apps/web/app/modules/News`.
- The backend News API lives in `apps/api/src/news`; it exposes public read routes, manager draft routes, preview generation, localized updates, deletion, and resource upload.
- News management uses `PERMISSIONS.NEWS_MANAGE` and `PERMISSIONS.NEWS_MANAGE_OWN`; public reading is gated by tenant News settings, post status, post visibility, and `PERMISSIONS.NEWS_READ_PUBLIC`.
- News content follows the active content language and supports localized resource handling through the shared language selector pattern.
- Rich text uploads reuse the existing Mentingo upload pipeline for images, documents, and videos attached to the news entity.

## Test Evidence

Frontend Playwright coverage proves that admins can browse, open, create, update, and delete news, and that visitors can access published public news while private news stays hidden. The current source search did not find dedicated backend News E2E specs, so backend behavior is evidenced primarily by controller/service implementation and the frontend E2E flows that exercise the API.
