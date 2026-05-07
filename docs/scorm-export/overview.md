# SCORM Course Export Overview

## What We Are Building

SCORM course export lets an admin or content creator take an existing Mentingo course and download it as a self-contained SCORM 1.2 package.

The exported package should work inside another LMS without calling our backend. Everything needed to run the exported course is included in the zip:

- SCORM manifest
- standalone lesson player
- frozen course data
- lesson assets
- styling
- quiz runtime
- Video.js runtime for exported video playback

## Supported Course Content

V1 supports these lesson types:

- Content lessons
- Quiz lessons
- Embed lessons

V1 does not support:

- AI mentor lessons
- Imported SCORM lessons

If a course contains unsupported lesson types, the frontend should warn the user before export and the export package should include only the supported lessons.

## Package Structure

The SCORM package contains one shared player and one JSON snapshot of the course. Each SCO launches the same player with a different lesson id, so the player knows which lesson to render.

Example structure:

```text
imsmanifest.xml
player/index.html
player/main.js
player/styles.css
data/course.json
assets/resources/...
assets/media/...
```

The player reads `data/course.json`, finds the current lesson based on the launched SCO, renders that lesson, and reports progress to the LMS through the SCORM 1.2 API.

V1 should not create one JSON file per SCO. A single `course.json` keeps course order, chapter structure, shared settings, lesson data, and asset references in one source of truth. If exported courses become too large later, we can keep the same manifest/player model and split heavy lesson payloads into `data/lessons/{lessonId}.json`.

## Course And Lesson Mapping

The SCORM manifest should preserve the course structure:

- The course is the top-level organization.
- Chapters are grouping items.
- Each supported lesson is a SCO.

This means each lesson can be tracked independently by the LMS while still appearing under the correct chapter.

The course intro should not be its own SCO. The first actual lesson SCO can later show an intro overlay before rendering the lesson, but the V1 prototype skips this overlay and opens directly into the selected lesson.

## Lesson Behavior

Content lessons render the exported rich text and bundled files. If the lesson contains videos, v1 uses Video.js so self-hosted videos and supported providers such as Bunny, Vimeo, and YouTube can use one consistent player path.

Quiz lessons render from frozen quiz data. The player evaluates answers locally and stores the learner's answers in SCORM `suspend_data`.

Embed lessons render configured iframe resources. Some providers may block embedding inside another LMS iframe, so the player should also show a fallback link.

## Completion

Completion rules are intentionally simple for v1:

- Content lessons complete when viewed.
- Embed lessons complete when viewed.
- Quiz lessons complete when submitted.

When the intro overlay is added later, pressing Start must not complete the first lesson by itself. The first lesson should follow its normal completion rule only after the overlay is dismissed and the actual lesson is rendered.

Quiz feedback behavior uses the course setting at export time. The exported package should not change if the original course settings are changed later.

## Why This Shape

The package should not bundle our full web app. A small standalone player is safer and easier to run inside other LMS environments because it avoids our normal routing, authentication, API, and app shell assumptions.

The player should reuse shared quiz evaluation logic where possible, but it should have its own SCORM-friendly UI.
