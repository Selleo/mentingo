# Email template builder — review remediation

Date: 2026-09-11

## Review findings

1. Mutation validation now runs inside the repository's tenant/event mutation lock. Update, publish, base-language change, archive, and restore acquire the same advisory lock; the selected row is re-read with FOR UPDATE before validation. Existing tenant transaction context carries the subsequent writes. Publication still archives/replaces in the same transaction.
2. Mandatory action links are checked separately for each complete translation. The registered action token must be the entire URL of a visible button or text link. Tokens in alt text or another language cannot satisfy this requirement.
3. Preview selects one complete language for subject and body. Missing/blank translations fall back as a unit; the returned language reports the actual choice.
4. Image hostname normalization strips a terminal dot and rejects IPv4-mapped IPv6 addresses, closing the localhost-dot and mapped-loopback bypasses. No external-image fetch was introduced.
5. Preview receives the tenant's logo as embedded image data. Rendering takes company_name from tenant branding. A missing logo renders the company name rather than an unresolved CID reference.
6. The overdue-course default uses the actual courses collection. The existing localized formatter expands every course, group, and student; sample data contains concrete values. Fictional top-level scalar variables were removed from this event.
7. API errors and warnings use translation keys with entries in all seven web locales.
8. Footer blocks support rich paragraphs and marks while retaining legacy attrs.text compatibility. Missing headers and footers generate warning keys.
9. Default and override API responses expose allowed variable definitions, required flags, and sample values.
10. The persistence record type lives in the repository. Validation uses block constants. Pagination includes id as a deterministic ordering tie-breaker.

## Verification

- 21 focused Jest tests pass: registry/language rendering, action-link checks, whole-template fallback, hostname bypasses, collection expansion, schema rejection, footer rich content, and mutation validation while the lock is held.
- These mutation tests use a repository mock. They do not prove PostgreSQL advisory-lock behavior, simultaneous-request behavior, or RLS isolation.
- Package build, API TypeScript, and focused ESLint checks are run for the modified implementation.
- Email-template Swagger contracts use the standard API Swagger generation flow. The web API client is generated with pnpm generate:client.

## Remaining implementation stages

The review's broader capability gaps were not completed by these ten fixes. The follow-up implementation on 2026-09-14 adds runtime override delivery, queued administrator-only test sends, tenant-owned uploaded images, tenant-template duplication, and idempotent example-draft provisioning. Activity logging and the web editor remain, along with PostgreSQL concurrency/RLS and full controller/browser E2E coverage.

The follow-up verification passed 61 focused tests across 11 suites. Runtime delivery falls back to the existing code-rendered email when no override is published; legacy queued password emails without template context retain their original rendering. Uploaded images use inline attachments, not expiring delivery URLs. No real emails were sent during verification.

The feature should not be described as complete or ready for production delivery until those stages are implemented and verified.
