# Permission Matrix

Legend:

- `Yes` = allowed
- `Yes*` = allowed with additional conditions
- `No` = not allowed
- `?` = unclear from current implementation

## Authentication & Account

| Permission              | What it covers                                                                                                 | Anonymous | Student | Content Creator | Admin |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | --------: | ------: | --------------: | ----: |
| `account.access_public` | Registration, password recovery, email/password sign-in, SSO/magic-link entrypoints, refresh, support callback |       Yes |      No |              No |    No |
| `account.read_self`     | View current session and own account context                                                                   |        No |     Yes |             Yes |   Yes |
| `account.update_self`   | Update own profile, password, onboarding progress, exit support session                                        |        No |   Yes\* |           Yes\* | Yes\* |
| `account.mfa`           | Set up and verify MFA for own account                                                                          |        No |     Yes |             Yes |   Yes |

## Users

| Permission       | What it covers                                                                  | Anonymous | Student | Content Creator | Admin |
| ---------------- | ------------------------------------------------------------------------------- | --------: | ------: | --------------: | ----: |
| `user.read_self` | View own profile and details                                                    |        No |     Yes |             Yes |   Yes |
| `user.manage`    | View all users, create, update, delete, import, bulk role/group/archive changes |        No |      No |              No |   Yes |

## Settings & Environment

| Permission             | What it covers                                                                      | Anonymous | Student | Content Creator | Admin |
| ---------------------- | ----------------------------------------------------------------------------------- | --------: | ------: | --------------: | ----: |
| `settings.read_public` | Public platform settings, public branding assets, login page assets                 |       Yes |      No |              No |    No |
| `settings.read_self`   | View own personal settings                                                          |        No |     Yes |             Yes |   Yes |
| `settings.update_self` | Update own personal settings                                                        |        No |   Yes\* |           Yes\* | Yes\* |
| `settings.manage`      | Organization-wide settings, branding, login page files, admin notification settings |        No |      No |              No | Yes\* |
| `env.read_public`      | Public SSO status and public Stripe key                                             |       Yes |      No |              No |    No |
| `env.read_status`      | Stripe, AI, and Luma configuration status                                           |        No |     Yes |             Yes |   Yes |
| `env.manage`           | Secret/config environment values and setup operations                               |        No |      No |              No |   Yes |

## Categories & Groups

| Permission        | What it covers                                               | Anonymous | Student | Content Creator | Admin |
| ----------------- | ------------------------------------------------------------ | --------: | ------: | --------------: | ----: |
| `category.read`   | Category list and category reads                             |     Yes\* |   Yes\* |           Yes\* |   Yes |
| `category.manage` | Create, update, and delete categories                        |        No |      No |              No |   Yes |
| `group.read`      | Group reads and listings                                     |        No |      No |              No |   Yes |
| `group.manage`    | Create, update, delete, and membership management for groups |        No |      No |              No |   Yes |

## Courses

| Permission               | What it covers                                                                                                         | Anonymous | Student | Content Creator | Admin |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------: | ------: | --------------: | ----: |
| `course.read_public`     | Public catalog and public course discovery                                                                             |       Yes |      No |              No |    No |
| `course.read_assigned`   | View assigned or enrolled courses list                                                                                 |        No |     Yes |             Yes |   Yes |
| `course.read_manageable` | View courses I can manage                                                                                              |        No |      No |           Yes\* |   Yes |
| `course.read`            | Course reads in authenticated flows, including course structure and content reads, but not statistics                  |        No |   Yes\* |           Yes\* |   Yes |
| `course.create`          | Create a new course                                                                                                    |        No |      No |             Yes |   Yes |
| `course.update`          | Update course content and structure: course settings, chapters, lessons, uploads, translations, certificates, trailers |        No |      No |           Yes\* |   Yes |
| `course.delete`          | Delete courses                                                                                                         |        No |      No |               ? |   Yes |
| `course.enrollment`      | Individual and group enrollment/unenrollment                                                                           |        No |   Yes\* |              No | Yes\* |
| `course.statistics`      | Course statistics and related reporting filters                                                                        |        No |      No |           Yes\* |   Yes |
| `course.ownership`       | Ownership reads and ownership transfer                                                                                 |        No |      No |              No |   Yes |
| `course.export`          | Master export flows, export jobs, export candidates                                                                    |        No |      No |              No | Yes\* |

## Learning, Certificates & Files

| Permission                 | What it covers                                                     | Anonymous | Student | Content Creator | Admin |
| -------------------------- | ------------------------------------------------------------------ | --------: | ------: | --------------: | ----: |
| `learning_progress.update` | Lesson progress updates and learner progress actions               |        No |   Yes\* |             Yes |   Yes |
| `certificate.read`         | Certificate reads and certificate listing                          |        No |       ? |               ? |     ? |
| `certificate.share`        | Create certificate share links and public certificate share access |     Yes\* |   Yes\* |           Yes\* | Yes\* |
| `certificate.render`       | Render/download certificate PDF from HTML                          |        No |     Yes |             Yes |   Yes |
| `file.upload`              | Generic file upload                                                |        No |     Yes |             Yes |   Yes |
| `file.video`               | Video upload init, upload transport, and upload status             |     Yes\* |     Yes |             Yes |   Yes |
| `file.delete`              | Delete uploaded files                                              |        No |      No |             Yes |   Yes |
| `file.read_public`         | Public thumbnails and public media webhooks                        |       Yes |      No |              No |    No |

## AI, Content, And Publishing

| Permission            | What it covers                                                       | Anonymous | Student | Content Creator | Admin |
| --------------------- | -------------------------------------------------------------------- | --------: | ------: | --------------: | ----: |
| `ai.use`              | AI mentor threads, chat, judging, and retakes                        |        No |     Yes |             Yes |   Yes |
| `luma.manage`         | Luma course generation workflows                                     |        No |      No |           Yes\* |   Yes |
| `ingestion.manage`    | Ingest, list, and delete lesson documents                            |        No |      No |           Yes\* |   Yes |
| `announcement.read`   | Read and mark announcements                                          |        No |     Yes |             Yes |   Yes |
| `announcement.create` | Create announcements                                                 |        No |      No |             Yes |   Yes |
| `news.read_public`    | Public news reads                                                    |     Yes\* |      No |              No |    No |
| `news.manage`         | Create, update, publish, preview, delete, and upload news content    |        No |      No |           Yes\* |   Yes |
| `article.read_public` | Public article reads                                                 |     Yes\* |      No |              No |    No |
| `article.manage`      | Create, update, publish, preview, delete, and upload article content |        No |      No |           Yes\* |   Yes |
| `qa.read_public`      | Public FAQ reads                                                     |       Yes |      No |              No |    No |
| `qa.manage`           | FAQ create, update, delete, and language operations                  |        No |      No |              No |   Yes |

## Reporting, Billing & Platform

| Permission               | What it covers                                                     | Anonymous | Student | Content Creator | Admin |
| ------------------------ | ------------------------------------------------------------------ | --------: | ------: | --------------: | ----: |
| `report.read`            | Summary reporting                                                  |        No |      No |             Yes |   Yes |
| `statistics.read_self`   | View own statistics                                                |        No |     Yes |             Yes |   Yes |
| `statistics.read`        | Organization/content statistics                                    |        No |      No |             Yes |   Yes |
| `billing.checkout`       | Checkout and payment session creation                              |        No |     Yes |              No |    No |
| `billing.manage`         | Promotion code and billing administration                          |     Yes\* |      No |              No |   Yes |
| `integration_key.manage` | Integration API key management                                     |        No |      No |              No |   Yes |
| `integration_api.use`    | Integration admin API usage                                        |     Yes\* |      No |              No |    No |
| `tenant.manage`          | Cross-tenant admin operations and support-session tenant switching |        No |      No |              No | Yes\* |
| `scorm.upload`           | SCORM package upload                                               |        No |      No |           Yes\* |   Yes |
| `scorm.read`             | SCORM content and metadata reads                                   |        No |   Yes\* |           Yes\* |   Yes |
| `analytics.read`         | Analytics reads guarded by secret access                           |     Yes\* |      No |              No |    No |
| `health.read`            | Healthcheck access                                                 |       Yes |      No |              No |    No |

## Conditions Behind `Yes*`

- `self only`: action is limited to the current user
- `owns content`: content creator must own the relevant course/content
- `assigned or enrolled`: student must be assigned to the relevant course or lesson
- `support mode blocked`: action is blocked during support mode
- `managing tenant only`: admin must belong to a managing tenant
- `public setting enabled`: public access depends on publication state or tenant settings
- `integration or secret guard`: access depends on API key or secret-based guard rather than normal login
- `unclear in current implementation`: current controller/service behavior needs confirmation

## Grouping Rules Used

- `course.read` includes normal course-related reads, including structure/content reads, but excludes statistics
- `course.update` includes course structure/content changes such as chapters, lessons, settings, uploads, and translations
- `course.enrollment` includes both individual and group enrollment and unenrollment
- `settings.manage` groups tenant-wide and admin-only settings operations
- `news.manage` and `article.manage` group draft, publish, preview, language, delete, and upload actions
