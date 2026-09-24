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
