# Knowledge Base Articles Business Spec

## Business Overview

Knowledge Base Articles give HR, L&D, and internal content teams a structured place to maintain durable guidance, policies, and learning reference material. Articles are organized into sections so learners can browse a coherent knowledge base instead of searching through disconnected documents.

Authorized content managers can draft, localize, preview, publish, and control public access to articles. The editor preserves work across languages and saves all changed translations together, while each language can have its own cover image.

## Who Uses It

- HR and L&D administrators organize policies, onboarding guidance, and learning references into sections that are easy to browse.
- Content managers maintain multilingual article titles, summaries, rich content, and cover imagery before publishing.
- Learners browse published knowledge by section and read the version prepared for their selected language.
- Public visitors can read selected published articles when tenant settings and article visibility allow it.

## Feature Functions

- Organize articles into named, multilingual sections.
- Create and edit localized titles, summaries, rich content, and cover images.
- Preserve unsaved edits while switching between supported languages and save all changed translations together.
- Preview the active language's rich content before publishing.
- Control whether a published article is available to non-logged-in visitors.
- Confirm destructive deletion before permanently removing an article or section, including direct section deletion from the knowledge-base list.
- Restrict management and public access through permissions, ownership, feature settings, status, and visibility.

## End-User Value

The Knowledge Base gives employees a consistent source of truth inside the learning platform. Multilingual authoring improves access for international teams, sections make information easier to discover, and the draft/public controls let content owners prepare and govern material safely.

## How It Works

A content manager adds sections from the end of the section list. Selecting "New article" at the end of an expanded section immediately creates the entry in that section and opens its editor. They can update public visibility while editing title, summary, content, and cover independently for each language. Switching language does not overwrite another translation. The editor submits only translations changed during the session, while a single save can include changes from several languages.

When an article is published, Mentingo requires a title for every language currently attached to that article. Learners, trainers, and content creators can browse published articles through the section table of contents. Content creators with own-content management rights can read another author's article, but its edit and delete actions are hidden. Public visitors can open only articles allowed by both tenant configuration and the article's public setting.

Each localized cover is resolved for the requested language. Management views may fall back to the immutable base-language cover when the requested locale has no cover, rather than allowing another translation's image to take over.

## Key Technical Context

- The main web surfaces are `/articles`, `/articles/:articleId`, and `/articles/:articleId/edit`, implemented under `apps/web/app/modules/Articles`.
- The backend domain is `apps/api/src/articles`; article PATCH requests use multipart form data with a JSON `translations` array and language-keyed cover files.
- Article management uses `PERMISSIONS.ARTICLE_MANAGE` and `PERMISSIONS.ARTICLE_MANAGE_OWN`; public reading is additionally governed by tenant settings, publication status, and article visibility.
- Manager lists and article details fall back to each section and article's immutable base language; learner and public requests exclude content that is unavailable in the requested language.
- Rich content uses the shared resource-upload pipeline, while cover uploads retain the existing file-signature validation.
- Article and section activity snapshots retain localized values for all supported languages so audits are not limited to the last active locale.

## Test Evidence

Backend E2E coverage proves public/private listing, draft access, section management, multilingual batch updates, and simultaneous status/visibility changes. Frontend Playwright coverage proves article browsing, creation, editing, deletion, role access, author-aware management controls, and public/private access. Automated coverage for language-specific cover replacement and staged unsaved language switching remains a gap.
