# PR #1804 Implementation Plan

## Scope and constraints

This plan follows `FEEDBACK.md` for PR `#1804`. The review findings have been implemented in this worktree where feasible. Remaining partial items are explicitly recorded below; no destructive Git action or remote publication was performed.

## Feedback implementation matrix

| Feedback | Planned implementation | Current status |
| --- | --- | --- |
| F-001 Published-template API invariant | Enforce candidate diagnostics for published updates and add direct regression coverage | Implemented |
| F-002 Cleanup race | Include the updated template in reference checks and add cleanup-scope regression coverage | Implemented |
| F-003 Malformed public image references | Catch URI decoding failures and cover malformed input | Implemented |
| F-004 Payload validation and bounds | Enforce depth, count, text, and serialized-size limits at the API/render boundary | Implemented |
| F-005 Runtime consumer decision | Keep this release authoring-only; defer trigger binding and runtime delivery to a separately specified feature | Resolved as authoring-only |
| F-006 Mobile and unsaved-edit UX | Make the toolbar responsive and add Remix/browser dirty-navigation protection | Implemented |
| F-007 Cleanup durability | Run a synchronous tenant-scoped fallback when queue submission fails; durable reconciliation remains a follow-up | Partially implemented |
| F-008 Status transition matrix | Guard archived publication, make-draft, and unarchive transitions in the service | Implemented |
| F-009 Integrated coverage | Add focused backend regressions; broader controller/browser workflow remains a follow-up | Partially implemented |

## Recommended implementation order

1. Resolved F-005 as authoring-only and documented the absence of trigger binding.
2. Implemented F-001 and F-008 so the API owns published-content validity and lifecycle guards.
3. Implemented the race-safe portion of F-002 and the synchronous fallback portion of F-007.
4. Implemented F-003 and F-004 at the public/render/API boundaries.
5. Added focused regression coverage from F-009; controller/browser coverage remains next.
6. Implemented responsive toolbar and dirty-navigation behavior from F-006.
7. Run the narrowest API/web checks for each group, then the full contract/build/E2E checks required by the repository instructions.

## Existing PR feedback implementation status

These are observations of the current PR head, not changes made by this task:

| Existing feedback theme | Status in current head |
| --- | --- |
| Cheerio selector simplification | Implemented in `apps/api/src/email-notification-templates/utils/renderTemplateContent.ts:100-117` |
| Explicit API dependency versions | Implemented for the new API dependencies; web/package additions still include caret ranges and should follow the repository decision consistently |
| Await async announcement rendering | Implemented in `apps/api/src/announcements/handlers/announcement-email.handler.ts:67-81` |
| Existing validation pipe and file-type handling | Implemented in `apps/api/src/email-notification-templates/email-template-image.controller.ts:59-66` |
| Tenant-runner use in the cleanup worker | Implemented in `apps/api/src/email-notification-templates/email-template-cleanup.worker.ts:41-50` |
| Main controller/page/browser coverage | Not implemented; the PR test plan still lists these gaps |

## Definition of done for the follow-up implementation

- The API, not only the web UI, enforces published-template validity and status transitions.
- Image cleanup is tenant-scoped, idempotent, race-safe, and durable across queue outages.
- Public image references fail closed without turning malformed input into 500 responses.
- Template documents have an intentional supported shape and resource limits.
- The team has documented whether publication activates notifications or only prepares a template.
- Mobile editing does not clip core actions and dirty edits are not silently lost.
- The missing controller, tenant/auth, rendering, cleanup, and browser workflow tests are either present or explicitly tracked as deferred release risks.
- Generated API/schema artifacts are regenerated through existing scripts after any contract change.
