# News Hub Business Spec

## Business Overview

The News Hub gives HR, L&D, and internal communications teams a governed place to publish company and learning updates inside Mentingo. It turns ad hoc messages into structured news posts that learners can browse, open, and return to later.

The feature supports both everyday learner communication and editorial work. Learners see only published news that has a translation in their current interface language. Authorized managers and content creators can create drafts, prepare localized versions, add rich content, and decide whether a published item can also be read by public visitors. Manager and creator views use the immutable base language as a fallback when a requested locale is unavailable.

For HR and L&D, the value is consistency: policy updates, program announcements, platform changes, or training-related messages can live in the same learning environment where employees already complete courses and check announcements.

## Who Uses It

- HR and L&D administrators publish learning-program updates, policy notices, or internal communications that should be visible in the learner portal.
- Content managers prepare drafts, enrich posts with images or embedded resources, and review the post before publishing.
- Learners browse current news, open full articles, and move between related posts without leaving Mentingo.
- Public visitors can read selected published posts when the tenant allows public News access and the specific post is marked public.

## Feature Functions

- Preserve title, summary, and content changes for every affected language in the news activity history.
- Require explicit confirmation before permanently deleting news to prevent accidental content loss.
- Browse published news in a paginated News Hub.
- Open a news detail page with title, summary, cover image, author, publication date, rich content, table of contents, and previous or next navigation.
- Create draft news posts from the News page.
- Edit title, summary, content, status, visibility, and locale-specific cover images before publishing.
- Stage multiple localized versions in one editor session and save changed translations in one multipart request.
- Manage localized news versions so different audiences can read the same update in their selected language. New locales start blank and remain local until saved.
- Upload and embed supporting files, images, and videos in rich news content.
- Preview rich content before publishing.
- Limit draft, edit, delete, and public-read behavior through tenant settings, post visibility, publication status, and news permissions.

## End-User Value

News Hub gives learners a clear source for organizational and learning-related updates, while HR and L&D teams get a controlled publishing workflow instead of scattered messages. Multilingual content improves reach across international teams, and public/private visibility helps teams reuse Mentingo news for external-facing updates when appropriate.

## How It Works

A news manager opens the News page, creates an empty draft, and fills in the post in the News form. The form has its own active locale and preserves unsaved title, summary, rich content, and selected cover changes when locales are switched. Publication status and public visibility are shared by all locales. Publishing requires a title for every active locale. The preview is content-only and renders the active locale's unsaved rich-text HTML in the browser.

Learners and signed-in content creators open the News page to see published items, including posts published by other authors. The list highlights the first item on the first page, paginates the rest, and opens each post into a detailed article view. On the detail page, Mentingo renders the localized content, supporting media, article metadata, table of contents, and previous/next post navigation. Public visitors see only posts explicitly available to them.

Drafts are visible only to users who can manage news. Users with `news.manage` can manage every post; users with `news.manage_own` can manage only their own drafts and posts, resources, uploads, and language changes while retaining read access to other authors' published news. On another author's post, edit and delete actions are hidden. Management requests for another author's item return Not Found. Public visitors can access the News Hub only when public News access is enabled for the tenant and the post itself is published, public, and translated into the requested locale.

## Key Technical Context

- The user-facing web routes are `/news`, `/news/:newsId`, `/news/add`, and `/news/:newsId/edit`, implemented under `apps/web/app/modules/News`.
- The backend News API lives in `apps/api/src/news`; it exposes public read routes, manager draft routes, batched localized updates, deletion, and resource upload.
- News management uses `PERMISSIONS.NEWS_MANAGE` and `PERMISSIONS.NEWS_MANAGE_OWN`; public reading is gated by tenant News settings, post status, post visibility, and `PERMISSIONS.NEWS_READ_PUBLIC`.
- Learner and visitor reads are locale-strict. Manager and creator reads use the immutable base language as fallback for title, summary, content, and cover imagery.
- News content supports localized resource handling through the shared language selector pattern; cover images are locale-specific and selecting a replacement cover does not upload it until Save.
- Rich text uploads reuse the existing Mentingo upload pipeline for images, documents, and videos attached to the news entity.

## Test Evidence

Frontend Playwright coverage covers browsing and opening published news as both content creators and learners, creating, updating, and deleting news with explicit confirmation, plus public/private access. The News implementation should additionally be covered with API tests for strict locale filtering, manager fallback, own-only management isolation, and batch updates; web coverage should cover staged locale drafts, batch saves, publication title validation, local preview, and the absence of pagination for a one-page result.
