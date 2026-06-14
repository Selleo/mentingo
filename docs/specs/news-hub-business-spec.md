# News Hub Business Spec

## Business Overview

News Hub is the platform’s publishing area for company, learning, and program updates. It supports public and authenticated news browsing, multilingual content, drafts, rich media, and manager-controlled publishing.

For HR and L&D teams, News Hub provides an editorial channel that can support learning campaigns, internal communication, onboarding updates, and public-facing education content when enabled.

## Who Uses It

- Administrators and content managers who create and publish news.
- Course and learning program owners who communicate updates.
- Learners and employees who browse published news.
- Public visitors when unregistered news access is enabled.

## Feature Functions

- Browse published news with custom pagination.
- View news details with cover image, summary, author, publish date, rich content, table of contents, and previous/next navigation.
- Create draft news items.
- Edit title, summary, status, public visibility, cover image, and rich content.
- Add, update, or remove language versions subject to base-language rules.
- Upload and embed images, documents, presentations, videos, and other supported resources.
- Preview news content before publishing.
- Delete or archive news when permitted.
- Separate published and draft views for users with management permissions.
- Allow public access only when tenant settings and item visibility permit it.

## End-User Value

Learners get a central place for current organizational and learning-related updates. Content teams can prepare drafts, publish multilingual articles, and embed supporting assets without leaving the platform. Public access settings let organizations decide whether news should also support external communication.

## How It Works

Published news is available through the News page according to tenant settings, user authentication, and item-level public visibility. Managers can create an empty draft, edit content through the news form, upload resources, preview the article, and publish when ready.

The detail page renders the localized article, cover media, metadata, rich content, and adjacent article links. Resource access is checked so private news assets are not exposed to unauthorized visitors.

Management actions are permission-controlled. Users with global or own-news permissions can access draft lists, edit allowed items, manage languages, upload resources, and archive news.

## Key Technical Context

- Frontend routes include `/news`, `/news/:newsId`, `/news/add`, and `/news/:newsId/edit`.
- Public list, detail, and resource endpoints are available under `apps/api/src/news`, with manager-only endpoints for draft, preview, create, update, language management, delete, and upload.
- Permissions include `NEWS_READ_PUBLIC`, `NEWS_MANAGE`, and `NEWS_MANAGE_OWN`.
- News visibility depends on the News feature flag, unregistered-user news access setting, authentication state, article status, and `isPublic`.
- Resource uploads support common document, video, image, spreadsheet, and presentation formats.

## Test Evidence

- Web E2E coverage verifies list browsing, detail opening, admin create/update/delete flows, public access to published news, public denial for private news, and role-specific browsing for content creators and students.
- Backend behavior is evidenced by the News controller and service implementation. No dedicated backend News E2E spec was found in the current API test tree.
