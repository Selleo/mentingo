# Source image resources: Core companion

This is the companion to Mentingo AI's `jh_feat_source_image_resources` extension,
which is stacked separately above PDF vision PR
[mentingo-ai#65](https://github.com/Selleo/mentingo-ai/pull/65). The PDF foundation
can merge on its own. Deploy this Core change when the separate AI extension is
available; it is not required for the PDF-only feature.

## Behavior and boundaries

The shared authoring upload allowlist and both existing file pickers accept static
PNG, JPEG and WebP alongside documents, with the existing 25 MiB upload limit.
Mentingo AI validates pixels, persists normalized private images and interpretation
revisions, and proposes deliberately positioned image reuse. SVG/GIF uploads remain
outside the authoring source allowlist.

The review projection accepts `source.type=source_image` with source-version,
section and interpretation IDs, plus an exact UUID block anchor, before/after
position, caption and relevance. Review details show the source caption/relevance.
Generated visuals keep their existing projection. File hints and labels are updated
in all seven supported locales.

AI exports canonical figure markup and the existing immutable visual manifest.
Core's existing application service imports it as a native lesson resource at the
same position, retaining alt text and caption. No new resource importer, upload
controller, database migration or generated HTTP API contract is introduced.
Existing tenant/permission and frozen-export checks still own application access.

## Validation

- `pnpm lint-tsc-web` and `pnpm lint-tsc-api`: passed; the web check reports three
  existing import-style warnings in unrelated tests.
- Four focused CourseAuthoring web files: 99 tests passed. They cover both real
  picker accept values, image format validation, task/proposal projections and
  source-versus-generated review details.
- `course-authoring-apply.service.spec.ts`: 32 tests passed. The added case checks
  that an exported source figure becomes a native image resource between its two
  declared paragraphs, with alt text and caption intact and no staging URI left.
- Shared, prompts, email templates and SCORM workspace packages built successfully
  to supply the isolated worktree's runtime/type dependencies. Generated source
  files have no changes.

The AI companion separately validates durable ingestion, reinterpretation,
selection/exclusion fences, exact image hashes and retention-safe export copies.
Paid provider quality, production deployment and a fresh authenticated browser flow
were not exercised by these checks.

See the [course authoring business spec](specs/course-authoring-business-spec.md)
for the user workflow. Keep this companion in its own commit so both extensions
can be deferred while the PDF foundation ships.
