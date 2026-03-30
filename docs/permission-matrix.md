# Permission Matrix

Source of truth: `packages/shared/src/constants/permissions.ts` (`SYSTEM_ROLE_PERMISSIONS`).

Legend:

- `Yes` = granted to the system role
- `Yes*` = granted with additional scope checks in services/controllers
- `No` = not granted to the system role

## Account & User

| Permission            | Student | Content Creator | Admin | Notes                                             |
| --------------------- | ------: | --------------: | ----: | ------------------------------------------------- |
| `account.read_self`   |     Yes |             Yes |   Yes | Own account/session context                       |
| `account.update_self` |   Yes\* |           Yes\* | Yes\* | Self-only updates; may be limited in support mode |
| `user.read_self`      |     Yes |             Yes |   Yes | Own profile                                       |
| `user.manage`         |      No |              No |   Yes | User administration                               |

## Settings, Environment, Categories, Groups

| Permission             | Student | Content Creator | Admin | Notes                            |
| ---------------------- | ------: | --------------: | ----: | -------------------------------- |
| `settings.read_self`   |     Yes |             Yes |   Yes | Own settings                     |
| `settings.update_self` |   Yes\* |           Yes\* | Yes\* | Self-only updates                |
| `settings.manage`      |      No |              No |   Yes | Tenant/org settings              |
| `env.read_public`      |     Yes |             Yes |   Yes | Public env status/key visibility |
| `env.manage`           |      No |              No |   Yes | Secrets/configuration management |
| `category.read`        |     Yes |             Yes |   Yes | Category reads                   |
| `category.manage`      |      No |             Yes |   Yes | Category CRUD                    |
| `group.read`           |      No |             Yes |   Yes | Group reads/listing              |
| `group.manage`         |      No |             Yes |   Yes | Group CRUD/membership            |

## Courses & Learning

| Permission                 | Student | Content Creator | Admin | Notes                              |
| -------------------------- | ------: | --------------: | ----: | ---------------------------------- |
| `course.read_assigned`     |     Yes |             Yes |   Yes | Assigned/enrolled access           |
| `course.read_manageable`   |      No |           Yes\* |   Yes | Manageable-course scope            |
| `course.read`              |   Yes\* |           Yes\* |   Yes | Authenticated course content reads |
| `course.create`            |      No |             Yes |   Yes | Course creation                    |
| `course.update`            |      No |              No |   Yes | Any-course updates                 |
| `course.update_own`        |      No |           Yes\* |    No | Own-authored course updates only   |
| `course.delete`            |      No |              No |   Yes | Course deletion                    |
| `course.enrollment`        |      No |              No | Yes\* | Enrollment management              |
| `course.statistics`        |      No |           Yes\* |   Yes | Course stats access                |
| `course.export`            |      No |              No | Yes\* | Course export jobs                 |
| `course.ai_generation`     |      No |           Yes\* | Yes\* | Luma/AI generation flows           |
| `learning_mode.use`        |      No |           Yes\* |   Yes | Learner-mode paths                 |
| `learning_progress.update` |   Yes\* |           Yes\* |   Yes | Progress updates in learning flow  |

## Certificates & Files

| Permission           | Student | Content Creator | Admin | Notes                                   |
| -------------------- | ------: | --------------: | ----: | --------------------------------------- |
| `certificate.read`   |     Yes |             Yes |   Yes | Certificate listing/reads               |
| `certificate.share`  |   Yes\* |           Yes\* | Yes\* | Share-link creation/public share access |
| `certificate.render` |     Yes |             Yes |   Yes | Certificate PDF render/download         |
| `file.upload`        |     Yes |             Yes |   Yes | Generic upload                          |
| `file.delete`        |      No |             Yes |   Yes | Delete uploaded files                   |

## AI, Content, Publishing

| Permission            | Student | Content Creator | Admin | Notes                        |
| --------------------- | ------: | --------------: | ----: | ---------------------------- |
| `ai.use`              |     Yes |             Yes |   Yes | AI mentor/chat/judging flows |
| `announcement.read`   |     Yes |             Yes |   Yes | Read/mark announcements      |
| `announcement.create` |      No |             Yes |   Yes | Announcement creation        |
| `news.read_public`    |     Yes |             Yes |   Yes | Public news reads            |
| `news.manage`         |      No |              No |   Yes | Full news management         |
| `news.manage_own`     |      No |           Yes\* |    No | Own-news management only     |
| `article.read_public` |     Yes |             Yes |   Yes | Public article reads         |
| `article.manage`      |      No |              No |   Yes | Full article management      |
| `article.manage_own`  |      No |           Yes\* |    No | Own-article management only  |
| `qa.read_public`      |     Yes |             Yes |   Yes | Public FAQ reads             |
| `qa.manage`           |      No |              No |   Yes | Full FAQ management          |
| `qa.manage_own`       |      No |           Yes\* |    No | Own FAQ management only      |

## Reporting, Billing, Platform

| Permission               | Student | Content Creator | Admin | Notes                               |
| ------------------------ | ------: | --------------: | ----: | ----------------------------------- |
| `report.read`            |      No |             Yes |   Yes | Reporting reads                     |
| `statistics.read_self`   |     Yes |             Yes |   Yes | Own statistics                      |
| `statistics.read`        |      No |             Yes |   Yes | Org/content statistics              |
| `billing.checkout`       |     Yes |             Yes |   Yes | Checkout/payment session creation   |
| `billing.manage`         |      No |              No |   Yes | Billing admin/promo management      |
| `integration_key.manage` |      No |              No |   Yes | Integration API key management      |
| `integration_api.use`    |      No |              No |   Yes | Integration admin API access        |
| `tenant.manage`          |      No |              No | Yes\* | Cross-tenant/super-admin operations |
