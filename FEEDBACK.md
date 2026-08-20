# PR #1889 Feedback

## Review feedback

1. Resolved — `apps/api/src/settings/settings.service.ts` now uses the shared `COURSE_STATUSES.PUBLISHED` constant.
2. Resolved — `apps/api/src/settings/settings.service.ts` now accepts a single course ID or an array through one cleanup method, and all callers use it.

## Integration

- Merge the newest `origin/staging` into the PR branch.
- Resolve the controller import conflict by retaining both featured-course and dashboard settings contracts.
- Regenerate generated API artifacts only through repository scripts if the merged source contract requires it.
