# Learning Paths

## Summary

- Build learning paths as a first-class tenant resource with ordered course membership, optional sequence enforcement, tenant sharing, enrollment fan-out, and path-level certificates.
- Reuse the existing course, localization, file upload, outbox/CQRS, and certificate rendering patterns; add learning-path-specific tables/services where the current course model is too narrow.

## Phases

1. Phase 1, data model and API contracts: add `learning_paths`, `learning_path_courses`, `student_learning_paths`, and a normalized course-access source table so one course can belong to many paths and multiple sources can coexist; store localized `title` and `description` as JSONB, an image S3 key, and flags like `sequence_enforced` and `has_certificate`; expose CRUD, list/detail, add/remove-course, and reorder endpoints with a dedicated learning-path permission family and explicit admin/student access checks.
2. Phase 2, enrollment and progress engine: path enrollment should create the path enrollment record and ensure `student_courses` rows for every member course; keep source provenance so removing a path only revokes course access when no other direct/group/path source still grants it; compute path progress from ordered course completion, and when `sequence_enforced` is on, unlock course N+1 only after course N is complete; recalculate path progress through outbox/CQRS events whenever membership or completion changes.
3. Phase 3, sharing/export and certificates: add managing-tenant sharing for learning paths with export/sync metadata analogous to master-course export but path-aware; when exporting a path, export or link every member course and reuse an existing target course if that course is already shared; add path certificates as a first-class completion artifact and reuse the current certificate render/share flow, keyed off learning-path completion and localized path title.
4. Phase 4, web UI and navigation: add a new `Learning Paths` navigation entry and route set for student browsing, path detail, and admin management; build an editor with add/remove/reorder controls, sequence toggle, image upload, localized title/description fields, enrollment controls, and share/export actions; make the student view show ordered courses, locked/unlocked states, progress, and certificate state with a stronger LinkedIn Learning Paths feel than the current course list.

## Test Plan

- Add backend E2E coverage for admin create/edit/reorder/share flows, student enrollment/completion flows, and navigation/permission visibility.
- Keep backend regression coverage for existing course enrollment, group enrollment, course sharing, and course certificates where learning-path changes intersect them.

## Assumptions

- Introduce a dedicated learning-path permission family for management and enrollment surfaces instead of reusing course permissions wholesale.
- Keep path certificates separate from course certificates in v1, but reuse the same rendering/share infrastructure.
- Treat progress changes as recomputation, not history deletion; completed course history stays intact when a path changes.
- Do not generate migrations by hand; if a migration is needed, generate it from `apps/api` with `npx drizzle-kit generate --name=<meaningful-name>` or `npx drizzle-kit generate --custom --name=<meaningful-name>`.
