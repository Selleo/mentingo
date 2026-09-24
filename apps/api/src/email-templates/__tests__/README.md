# Email template tests

The HTTP suites cover all 16 routes in `EmailTemplateController`. They use the
real application, cookie authentication, permissions, TypeBox validation, and a
PostgreSQL application role without RLS bypass.

| Suite                           | Coverage                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-template-http`           | Every route's authentication/permission checks; template ID isolation; every registry default and copy; CRUD contracts and pagination.                                                          |
| `email-template-lifecycle`      | Translation merging, concurrent edits/publication, validation rollback, duplication, base language, archive/restore/delete.                                                                     |
| `email-template-preview-assets` | Every registry event in every supported language; invalid content through HTTP; upload limits, format validation, resource ownership, preview image embedding.                                  |
| `email-template-delivery`       | Every registry event through published delivery; real password-recovery and course-assignment triggers; language fallback, branding, attachments; real BullMQ completion, retries and failures. |

Existing deletion and translation integration suites and service/schema unit
tests remain in place. Publication error mapping is tested at the service layer
because the event lock prevents a deterministic uniqueness race through HTTP.

## Run

From the repository root:

```sh
pnpm --filter=api test:e2e --runInBand --testPathPattern='email-template|user-email-triggers.e2e-spec|auth.controller.e2e-spec'
pnpm --filter=api test --runInBand --testPathPattern='email-template|common/emails/emails.service.spec'
pnpm --filter=api lint-tsc
```

Use the dedicated test PostgreSQL database and Redis database configured by
`test/test-database.ts` (`DATABASE_TEST_URL` and `REDIS_TEST_URL`). E2E setup
truncates test tables; do not point these variables at application databases.
The E2E command enables Node's VM modules for the ESM-only file-type detector.

The shared fixture disables rate limits within each suite and restores the prior
setting on shutdown. Storage upload/read/sign operations use an in-memory fixture;
resource persistence, file detection, Sharp processing, and asset ownership stay
real. Email transport uses `EmailTestingAdapter`, so no external mail is sent.
Queue listeners are registered before submission and removed after bounded waits;
delivery cases finish their jobs before resetting fixtures.

## Known gap

The BMP acceptance case is skipped: BMP is in the shared upload allowlist, but
the current Sharp pipeline rejects BMP metadata. The test retains the intended
201 response rather than asserting that this rejection is correct. Fixing BMP
support is separate from this test-only change.
