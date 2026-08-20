# PR #1889 Feedback Fix Plan

- [x] Resolve the `settings.controller.ts` conflict while preserving both route contract imports.
- [x] Use `COURSE_STATUSES.PUBLISHED` in featured-course validation.
- [x] Consolidate singular and bulk featured-course cleanup into one helper and update all callers.
- [x] Add or update the featured-course business spec required by the repository definition of done.
- [x] Run focused API lint/typecheck; generated contracts did not require source changes.
- [ ] Run the affected API E2E suites; startup currently fails in merged-branch Nest dependency resolution before tests execute.
- [ ] Inspect the final diff, commit the scoped changes, and push the exact PR head branch.
