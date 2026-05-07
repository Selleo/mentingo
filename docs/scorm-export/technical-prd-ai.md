# SCORM Course Export Technical PRD

## Summary

Implement course-to-SCORM export as a backend-generated, self-contained SCORM 1.2 zip. The package contains a standalone player, static assets, frozen course data, and `imsmanifest.xml`. V1 supports content, quiz, and embed lessons. AI mentor and imported SCORM lessons are unsupported.

## Export Contract

Add an explicit export action for users who can manage the course. The endpoint should return a generated `.zip` file or a download response.

The export must:

- Allow draft and published courses.
- Let the frontend warn about unsupported lesson types before export.
- Generate the package from supported lessons only.
- Freeze course settings at export time.
- Include all required lesson assets.
- Produce a package that does not call Mentingo APIs at runtime.

## Generated Package

Use this logical structure:

```text
imsmanifest.xml
player/index.html
player/main.js
player/styles.css
player/video-js.css
player/video-js.js
player/launch/{lessonId}.html
data/course.json
assets/resources/{resourceId}/{filename}
assets/questions/{questionId}/{filename}
assets/course/{filename}
```

The implementation may hash filenames or add subdirectories, but all runtime references must be relative and deterministic.

V1 must use one shared `data/course.json` file, not one full JSON file per SCO. The SCO identity comes from the launch URL, and the player selects the matching lesson from `course.json`.

## Manifest Model

Generate SCORM 1.2 `imsmanifest.xml`.

Mapping:

- Course becomes the manifest organization.
- Chapters become non-launchable grouping items.
- Each supported lesson becomes one SCO item.
- Each SCO points to a generated launch file that redirects to the shared player with a lesson identifier.

Recommended manifest launch URL:

```text
player/launch/{lessonId}.html
```

Each SCO resource should reference the player files, `data/course.json`, and any assets needed by that lesson. The SCO should not require its own lesson JSON file in v1.

## `course.json`

`course.json` is the runtime source of truth.

It should include:

- Course id, title, description, base language, exported language.
- Course thumbnail relative asset path.
- App logo or Mentingo signet relative asset path.
- Frozen course settings, including quiz feedback setting.
- Ordered chapters.
- Ordered lessons.
- Lesson type and lesson title.
- Content lesson HTML/body and asset references.
- Embed lesson resources, iframe URL, and `allowFullscreen`.
- Quiz questions, answers/options, correct-answer metadata, threshold score, attempts or cooldown metadata if needed by export behavior.
- Relative asset paths for all included resources.

Do not include tenant-private runtime data, user progress, or Mentingo API URLs.

Recommended shape:

```json
{
  "course": {},
  "settings": {},
  "chapters": [
    {
      "id": "chapter-id",
      "title": "Chapter title",
      "lessonIds": ["lesson-id"]
    }
  ],
  "lessons": {
    "lesson-id": {
      "id": "lesson-id",
      "type": "content",
      "title": "Lesson title"
    }
  }
}
```

Future escape hatch: if `course.json` becomes too large, keep it as the course index and move heavy lesson payloads to `data/lessons/{lessonId}.json`. Do not design v1 around that split unless package size testing proves it is needed.

## Course Intro Overlay

Do not generate a dedicated intro SCO. The V1 prototype skips the intro overlay and launches directly into the selected lesson. If the intro is added later, render it as an overlay inside the first actual lesson SCO.

Future runtime rule:

- If current lesson is the first supported lesson and `introSeen !== true`, show the intro overlay before rendering the lesson body.
- Overlay uses the course thumbnail, course title, optional description, and configured app logo or Mentingo signet fallback.
- Start button hides the overlay.
- Start button writes `introSeen: true` into `cmi.suspend_data` and commits.
- Start button must not mark the first lesson complete.
- After overlay dismissal, render the first lesson and apply the normal completion rule for that lesson type.

## Player Runtime

Build a small standalone player bundle, not the full web app.

Responsibilities:

- Locate SCORM 1.2 API in parent/opener window.
- Call `LMSInitialize` on load.
- Load `data/course.json`.
- Resolve the current lesson from `lessonId`.
- Render based on lesson type.
- Render the intro overlay before the first lesson when that deferred feature is enabled.
- Persist resume state in `cmi.suspend_data`.
- Write score to `cmi.core.score.raw` for quizzes.
- Write completion to `cmi.core.lesson_status`.
- Call `LMSCommit` after meaningful state changes.
- Call `LMSFinish` before unload or after explicit finish.

Completion:

- Content and embed lessons mark complete after successful render/view.
- Quiz lessons mark complete after submit.
- When the deferred intro overlay exists, first lesson completion only starts after intro overlay dismissal.

Navigation:

- The player may show previous/next lesson controls.
- Moving to another lesson should complete/commit the current SCO first.
- If direct SCO navigation is not possible in the host LMS, show a clear state telling the learner to continue in the LMS navigation.

## Quiz Runtime

Do not duplicate quiz rules manually in unrelated code.

Extract or create a headless quiz evaluation module that can be used by the SCORM player and, later, by the main app if desired.

The quiz module should handle:

- Answer selection state.
- Supported question types.
- Scoring.
- Pass/fail decision.
- Feedback visibility based on frozen course setting.
- Serialization of learner answers.

Store learner quiz state in `cmi.suspend_data` as compact JSON keyed by lesson id.

Example shape:

```json
{
  "lessons": {
    "lesson-id": {
      "answers": {},
      "submitted": true,
      "score": 80
    }
  }
}
```

Keep the serialized value below SCORM 1.2 `suspend_data` size limits. If needed, store only ids and primitive answer values.

## Asset Handling

During export:

- Find all resources referenced by supported lessons.
- Download or read each asset from storage.
- Copy assets into the zip.
- Rewrite rich-text resource references to relative paths.
- Preserve content types where useful.

Content video behavior for v1:

- Include Video.js in the exported runtime.
- Use Video.js for self-hosted video assets.
- Use the appropriate Video.js tech/plugin path for Bunny, Vimeo, and YouTube where the source/provider supports embedding.
- Keep provider URLs in `course.json` only when they are required to load the external provider. Bundled/self-hosted assets should use relative zip paths.
- If a provider blocks playback inside the target LMS iframe, show a clear fallback link.

Embed behavior:

- Render iframe resources as configured.
- Include fallback links for providers that block iframe embedding.

## Backend Implementation Notes

Recommended service boundaries:

- Export controller: permission check and response streaming.
- Export service: orchestration and validation.
- Snapshot builder: fetch course, chapters, lessons, questions, options, and resources.
- Package builder: write manifest, JSON, player files, and assets into zip.
- Player assets: compiled static JS/CSS checked into build output or generated during app build.

Keep generation stateless. Do not create DB rows for exported packages in v1 unless audit/history is explicitly required later.

## Validation Rules

Block export with translation-key errors when:

- Course is missing.
- User cannot manage the course.
- Course has no exportable lessons.
- Required file/resource cannot be copied.
- Manifest/package generation fails.

Warn or annotate, but do not block, for unsupported lesson types and embed URLs that may not work inside another LMS.

## Testing

Unit tests:

- Manifest generation preserves course, chapter, and lesson order.
- One SCO is generated per supported lesson.
- `course.json` includes frozen course settings and required lesson data.
- Asset rewriting converts storage references to relative zip paths.
- Quiz scoring and answer serialization work for supported question types.

Backend e2e:

- Admin can export draft and published course.
- Content creator can export own course.
- Unsupported AI mentor and SCORM lessons are skipped after frontend confirmation.
- Missing required resources block export.
- Generated zip contains manifest, player files, course JSON, and assets.

Player tests:

- Mock SCORM API receives initialize, set value, commit, finish.
- Content lesson marks complete on view.
- Embed lesson marks complete on view.
- Quiz submit stores answers in `suspend_data`, writes score, and completes.
