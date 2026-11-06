# Configuration

All configuration is done through environment variables. `apps/api/.env.example` is the authoritative list; this page explains what each group is for and what you must change before running in production.

## Required in every deployment

| Variable                           | Purpose                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | PostgreSQL connection used by tooling.                                                            |
| `LMS_DATABASE_URL`                 | Runtime connection with Row-Level Security enforced. **Use a least-privilege role.**              |
| `MIGRATOR_DATABASE_URL`            | Administrative connection used only by migrations and seeds.                                      |
| `REDIS_URL`                        | Cache, queues and the WebSocket adapter.                                                          |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing. Generate independently, never reuse across environments.                           |
| `JWT_EXPIRATION_TIME`              | Access token lifetime. Must match the cookie lifetime.                                            |
| `MASTER_KEY`                       | 32 bytes, base64. Required for the application to start. Generate with `openssl rand -base64 32`. |
| `CORS_ORIGIN`                      | The origin your tenant is served on.                                                              |

## Multi-tenancy

| Variable                   | Purpose                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DEV_TENANT_ORIGINS`       | Comma-separated tenant origins seeded and allowed in development.                                                           |
| `INTEGRATION_CORS_ORIGINS` | Additional origins allowed only for `/api/integration/*` routes - use this to embed Mentingo endpoints in your own product. |

## Single sign-on

Each provider is enabled independently, and the corresponding flag must be set in **both** the API and the web `.env`.

| Provider         | Variables                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Google Workspace | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_ENABLED`                                                |
| Microsoft 365    | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_MENTINGO_MARKER_PROPERTY`, `MICROSOFT_OAUTH_ENABLED` |
| Slack            | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_ENABLED`                                                   |

## AI

| Variable         | Purpose                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | Your own provider key. Prompts and learner content go to this provider and nowhere else. |

Model choice and provider configuration are also exposed in the admin interface, so you do not need a redeploy to change them.

### Luma first, OpenAI fallback

Every AI feature calls Luma first when Luma runs that capability on a Custom profile, and falls back to `OPENAI_API_KEY` when Luma is not configured, reports the capability as Core or Disabled, or the call fails. This covers:

- mentor chat, the judge, configuration generators and validators, translations, dictation and AI Mentor RAG embeddings
- the Core assistant and global search embeddings

Embeddings use the existing `luma.ai.createEmbeddings({ texts, dimensions })` SDK method and native `/api/public/v1/ai/embeddings` endpoint. Luma returns the model from the same resolved profile that produced the vectors. Core validates vector count, finite values, dimensions and model identity before using the result; an older Luma response without model metadata falls back safely. SDK 0.4 forwards the additive request/response fields unchanged, so this does not require an unpublished SDK dependency. The companion SDK update exposes those fields in its generated public types.

The Core assistant alone uses Luma's OpenAI-compatible chat endpoint (`/api/public/v1/ai/openai/chat/completions`) because its tool-calling loop needs the provider chat contract rather than the Mentor text-only SDK methods. The chat model must support tool calling.

Global search bounds its wait for the SDK response. SDK 0.4 cannot cancel an in-flight HTTP request, so a timed-out embedding request can finish remotely after Core has used its fallback. It cannot mutate application state; its late response is ignored.

Global search records which model embedded each chunk and compares a query only with chunks from the same model. When a query falls back to OpenAI against a Luma-indexed corpus, search returns keyword results instead of mixing vector spaces.

AI Mentor lesson documents do not record their embedding model. Re-upload them after the embedding model changes or after documents were embedded during a Luma outage.

The native embeddings and assistant relay integration is independent of course-source image
reading. Luma's source vision continues to use its dedicated `courseGenerationVision`
configuration and bounded PNG reader; the assistant relay does not select its vision model.

### Local contract verification

The runtime suite covers malformed embedding responses, model metadata, bounded waits,
assistant tool-call fallback before a stream opens, and preservation of errors after a stream
opens. A loopback HTTP test uses the installed published SDK to verify the native path,
`X-API-Key`, raw Unicode text, dimensions and returned model without a paid provider.

A combined local check also ran Core's runtime service and the published SDK against the
actual Luma FastAPI embeddings controller and runtime service after alignment with the
current PDF vision implementation. It verified two raw texts, 1536-dimensional finite vectors,
the model reported by that same invocation and absence of Core fallback. Authentication and
provider output were controlled fixtures; this is transport/service-contract evidence, not a
live model-quality, database integration, browser or deployment check.

## Storage and media

| Variable                                                                                                                                      | Purpose                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`                                                      | Any S3-compatible object storage. MinIO is used in development. |
| `AWS_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`                                                                 | AWS-specific storage and SES.                                   |
| `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_READ_ONLY_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_CDN_URL`, `BUNNY_STREAM_TOKEN_SIGNING_KEY` | Video hosting with signed, expiring URLs. Optional.             |

## Email

| Variable                                                                  | Purpose                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `EMAIL_ADAPTER`                                                           | `mailhog` in development; SMTP or SES in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_EMAIL_FROM` | SMTP delivery.                                       |

## Payments

| Variable                                                               | Purpose                              |
| ---------------------------------------------------------------------- | ------------------------------------ |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional - only if you sell courses. |

## Operations

| Variable                           | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `WORKER_CONCURRENCY`               | BullMQ worker concurrency.                |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Error monitoring.                         |
| `ANALYTICS_SECRET`                 | Generate with `openssl rand --base64 32`. |
| `LUMA_BASE_URL`                    | Optional integration endpoint.            |

## Production checklist

- [ ] Every secret regenerated - no value copied from `.env.example`.
- [ ] `LMS_DATABASE_URL` uses a role without DDL privileges; `MIGRATOR_DATABASE_URL` is not available to the running application.
- [ ] Seeded demo accounts removed.
- [ ] `CORS_ORIGIN` and `INTEGRATION_CORS_ORIGINS` restricted to real domains.
- [ ] Object storage bucket is private; files are served through pre-signed URLs.
- [ ] Backups configured and a restore tested.
- [ ] AI provider and its data-processing terms reviewed before enabling AI features.

## Local-model alignment validation (2026-11-06)

Core PR #2111 was merged with current `main` (`a0df13891`) before checking the
Luma PR #63 contract against the newer PDF vision implementation. The focused
runtime, search, assistant and telemetry suite passed 89 tests across eight files.
`pnpm lint-tsc-api` passed, including the full API TypeScript, workflow TypeScript
and ESLint checks. Workspace packages were built locally first; the previous
email-template export compilation blocker is resolved in the current main branch.
No additional generated API changes, database migrations, provider calls or
production mutations were required for this alignment.
