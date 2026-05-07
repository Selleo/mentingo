# SCORM Course Export TODO

## 1. Package And Build Setup

- [x] Create `packages/scorm-export-runtime` for the browser-only SCORM player.
- [x] Create `packages/scorm-export-generator` for Node-side manifest, JSON, asset, and zip generation.
- [x] Add package build scripts so the API can depend on the generator and include the built runtime assets.
- [x] Define shared export types for course snapshot, `course.json`, manifest resources, runtime suspend data, and validation errors.
- [x] Add a static Mentingo signet fallback asset for exported packages.
- [x] Add Video.js and required provider tech/plugins to the export runtime bundle.

## 2. Backend Export Contract

- [x] Add a course SCORM export endpoint for admins/content creators who can manage the course.
- [x] Return a `.zip` download response with a deterministic filename.
- [x] Use translation-key errors for validation failures.
- [x] Keep export generation stateless; do not add DB history tables in v1.
- [ ] Wire the existing Sharing tab SCORM button to this endpoint after client generation.

## 3. Course Snapshot Builder

- [x] Fetch course metadata, base language, selected export language, available locales, settings, thumbnail, and category.
- [x] Fetch ordered chapters and ordered lessons.
- [x] Fetch quiz questions, options, correct answers, threshold, attempt metadata, and feedback-related settings.
- [x] Fetch content lesson rich text and referenced resources.
- [x] Fetch embed lesson resources, URLs, and `allowFullscreen`.
- [x] Fetch platform/app logo from settings; fall back to Mentingo signet when missing.

## 4. Export Validation

- [x] Block export when course does not exist or user cannot manage it.
- [x] Allow both draft and published courses.
- [x] Skip unsupported lesson types after frontend confirmation: AI mentor, imported SCORM, and any lesson type not supported by export V1.
- [x] Block courses with no exportable content, quiz, or embed lessons.
- [x] Block when required files or rich-text resources cannot be resolved.
- [ ] Warn or annotate embed URLs that may not work in nested LMS iframes, but do not block solely for that.

## 5. Asset Collection And Rewriting

- [x] Copy course thumbnail into the zip.
- [x] Copy configured app logo or Mentingo signet into the zip.
- [x] Copy content lesson files, images, PDFs, presentations, downloadable resources, and videos.
- [x] Copy quiz question images and other question assets.
- [x] Rewrite rich-text resource references to relative zip paths.
- [x] Use Video.js for bundled/self-hosted video assets.
- [x] Preserve Bunny, Vimeo, and YouTube provider references when required for playback.
- [x] Deduplicate reused assets where possible.

## 6. `course.json` Generation

- [x] Generate one shared `data/course.json` for the whole package.
- [x] Include course metadata, thumbnail path, logo path, frozen settings, chapters, lesson order, and lesson data.
- [x] Store lessons in an id-keyed map and chapters as ordered lesson id lists.
- [x] Include content lesson HTML and relative asset references.
- [x] Include quiz questions/options/correct-answer metadata and frozen quiz feedback behavior.
- [x] Include embed URLs, titles, and fullscreen settings.
- [x] Do not include tenant-private runtime data, user progress, or Mentingo API URLs.

## 7. Manifest Generation

- [x] Generate SCORM 1.2 `imsmanifest.xml`.
- [x] Use one organization for the exported course.
- [x] Render chapters as non-launchable grouping items.
- [x] Render each supported lesson as one launchable SCO.
- [x] Point each SCO to a generated launch file that redirects to the shared player with `lessonId`.
- [x] Reference `data/course.json`, player files, and required assets in manifest resources.
- [x] Preserve course, chapter, and lesson display order.

## 8. Runtime Player Shell

- [x] Build a small standalone player, not the full web app.
- [x] Load `data/course.json`.
- [x] Resolve current lesson from `lessonId`.
- [x] Locate SCORM 1.2 API from parent/opener windows.
- [x] Call `LMSInitialize` on load.
- [x] Commit meaningful state changes with `LMSCommit`.
- [x] Call `LMSFinish` on unload.
- [x] Render a simple course-aware layout using exported CSS/design tokens.

## 9. Course Intro Overlay

- [ ] Deferred for V1 prototype: show intro overlay only on the first actual lesson SCO.
- [ ] Deferred for V1 prototype: do not create a separate intro/thumbnail SCO.
- [ ] Deferred for V1 prototype: overlay shows course thumbnail, title, optional description, and app logo or Mentingo signet.
- [ ] Deferred for V1 prototype: Start button hides the overlay.
- [ ] Deferred for V1 prototype: store `introSeen: true` in `cmi.suspend_data` and commit.
- [ ] Deferred for V1 prototype: do not mark the first lesson complete only because Start was clicked.
- [ ] Deferred for V1 prototype: resume directly into the first lesson when `introSeen` is already true.

## 10. Lesson Renderers

- [x] Render content lessons from exported HTML and relative asset paths.
- [x] Render video content through Video.js, including self-hosted, Bunny, Vimeo, and YouTube sources where supported.
- [x] Mark content lessons complete once the actual content is visible.
- [x] Render embed lessons as iframe resources.
- [ ] Add fallback external links for iframe resources that fail or are blocked by provider policy.
- [x] Mark embed lessons complete once the actual embed view is visible.
- [x] Render quiz lessons from exported quiz data.
- [x] Mark quiz lessons complete only after submit.
- [ ] Add previous/next controls only as best-effort UX; do not rely on them for LMS sequencing.

## 11. Quiz Engine

- [ ] Extract or create a headless quiz evaluation module.
- [x] Support all question types selected for v1 export.
- [x] Calculate score and pass/fail from exported quiz data.
- [x] Apply frozen quiz feedback setting from `course.json`.
- [x] Serialize learner answers into compact SCORM `cmi.suspend_data`.
- [x] Write quiz score to `cmi.core.score.raw`.
- [x] Write completion status to `cmi.core.lesson_status`.
- [x] Keep suspend data below SCORM 1.2 size limits by storing ids and primitive answers only.

## 12. Zip Builder

- [x] Add runtime files, `course.json`, manifest, and assets to the zip.
- [x] Keep root-level `imsmanifest.xml`.
- [x] Use deterministic internal paths.
- [x] Stream zip directly to the HTTP response.
- [x] Ensure missing asset failures abort the export cleanly before sending a partial response.

## 13. Frontend Wiring

- [x] Enable the `Export SCORM package` button once the endpoint exists.
- [x] Download the returned zip without routing away from the Sharing tab.
- [x] Show translated validation errors from backend response.
- [x] Keep tenant sharing visible only for managing tenant admins.
- [x] Keep SCORM export visible for admins/content creators who can manage the course.
- [x] Add loading and disabled states for the SCORM export button.

## 14. Tests

- [ ] Unit test manifest generation order and SCO mapping.
- [ ] Unit test `course.json` serialization.
- [ ] Unit test rich-text asset rewriting.
- [ ] Unit test quiz scoring and suspend-data serialization.
- [ ] Backend e2e: admin exports draft course.
- [ ] Backend e2e: content creator exports own course.
- [ ] Backend e2e: unsupported AI mentor/SCORM lesson blocks export.
- [ ] Backend e2e: missing required asset blocks export.
- [ ] Zip smoke test: manifest, player files, `course.json`, thumbnail/logo, and lesson assets exist.
- [ ] Runtime tests with mocked SCORM API: initialize, commit, finish, completion, score, and suspend data.

## 15. Manual QA

- [ ] Import a generated package into a SCORM test LMS.
- [ ] Verify the LMS shows chapters and lesson SCOs in order.
- [ ] Verify first lesson intro overlay appears once and resumes correctly.
- [ ] Verify content lesson completion.
- [ ] Verify quiz answer restore, feedback, score, and completion.
- [ ] Verify embed lesson fallback behavior.
- [ ] Verify package runs without any Mentingo backend requests.
