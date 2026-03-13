# RBAC Migration Queue

## Segment 1: Authorization Foundation
- [x] Add `@RequirePermission` decorator and `PermissionsGuard`
- [x] Add permission utility helpers (`hasPermission`, `hasAnyPermission`)
- [x] Add `PermissionsService` that resolves user role slugs and unioned permissions from permission tables
- [x] Include role-slug and permission payload support in auth token flow
- [x] Add temporary compatibility bridge in `RolesGuard` to evaluate using permissions
- [x] Checkpoint complete

## Segment 2: Auth Core
- [x] Migrate `auth.controller` guarded endpoints to `@RequirePermission`
- [x] Update `current-user` schema to include `roleSlugs` and `permissions`
- [x] Checkpoint complete

## Segment 3: Permission Matrix / Constants Alignment
- [x] Add explicit learning mode permission in shared constants
- [x] Ensure learning mode permission is granted to Student, Content Creator, Admin system roles
- [x] Add learning mode row to `docs/permission-matrix.md`
- [x] Checkpoint complete

## Segment 4: Replace Remaining Role-Based Checks In API Modules
- [x] Migrate `user.controller` from `@Roles` to `@RequirePermission`
- [x] Replace `@CurrentUser("role")` usage in user resource with permission-driven checks
- [x] Replace `user.service` role comparisons/queries with permission-role assignment joins
- [x] Migrate `category.controller` from `@Roles` to `@RequirePermission`
- [x] Replace category role checks with permission-driven flow
- [x] Migrate `group.controller` from `@Roles` to `@RequirePermission`
- [x] Replace group role comparisons (`users.role`) with permission-role slug resolution
- [x] Align chapter/lesson edit endpoints with `PERMISSIONS.COURSE_UPDATE`
- [x] Switch chapter/lesson edit access validation to permission-based checks (no role checks)
- [x] Align course edit endpoints with `PERMISSIONS.COURSE_UPDATE`
- [x] Switch course edit service checks from role-based to permission-based where updated
- [x] Migrate `news.controller` to `@RequirePermission(PERMISSIONS.NEWS_MANAGE)` for manage endpoints
- [x] Replace `news.service` role checks with permission checks (`PERMISSIONS.NEWS_MANAGE`)
- [x] Migrate `articles.controller` to `@RequirePermission(PERMISSIONS.ARTICLE_MANAGE)` for manage endpoints
- [x] Replace `articles` service/repository role checks with permission checks (`PERMISSIONS.ARTICLE_MANAGE` / `PERMISSIONS.USER_MANAGE`)
- [x] Migrate `settings.controller` to `@RequirePermission(PERMISSIONS.SETTINGS_MANAGE)` for admin/manage endpoints
- [x] Migrate `ai.controller` from `@Roles` to `@RequirePermission(PERMISSIONS.AI_USE)`
- [x] Replace AI role-based thread/retake authorization with permission-based checks
- [x] Migrate `report.controller` from `@Roles` to `@RequirePermission(PERMISSIONS.REPORT_READ)`
- [x] Replace `report.repository` role-based filtering (`users.role` / `currentUser.role`) with permission-based scope checks
- [x] Migrate `qa.controller` to `@RequirePermission(PERMISSIONS.QA_MANAGE/QA_READ_PUBLIC)` and remove `RolesGuard`
- [x] Migrate `env.controller` to `@RequirePermission(PERMISSIONS.ENV_*)` and remove `RolesGuard`
- [x] Migrate `luma.controller` to `@RequirePermission(PERMISSIONS.LUMA_MANAGE)` and remove `RolesGuard`
- [x] Replace `luma.service` role-based course access call with permission-aware `currentUser` flow
- [x] Migrate `stripe.controller` to `@RequirePermission(PERMISSIONS.BILLING_CHECKOUT/BILLING_MANAGE)`
- [x] Migrate `scorm.controller` to `@RequirePermission(PERMISSIONS.SCORM_UPLOAD/SCORM_READ)` and remove `RolesGuard`
- [x] Migrate `certificates.controller` to `@RequirePermission(PERMISSIONS.CERTIFICATE_*)` and remove `RolesGuard`
- [x] Migrate `integration` controllers to `@RequirePermission(PERMISSIONS.INTEGRATION_API_USE/INTEGRATION_KEY_MANAGE)` and remove `RolesGuard`
- [x] Replace `integration.service` API-key owner admin-role check with permission-resolution check (`PERMISSIONS.INTEGRATION_API_USE`)
- [x] Migrate `ingestion.controller` to `@RequirePermission(PERMISSIONS.INGESTION_MANAGE)` and remove `RolesGuard`
- [x] Replace `ingestion.service` role-based author/admin branching with permission-based checks
- [x] Migrate `announcements.controller` to `@RequirePermission(PERMISSIONS.ANNOUNCEMENT_READ/ANNOUNCEMENT_CREATE)` and remove `RolesGuard`
- [x] Replace `announcements.repository` role-based recipient filtering (`users.role = admin`) with permission-based filtering
- [ ] Checkpoint complete

## Segment 5: Cleanup
- [ ] Delete legacy role-based auth artifacts (`roles.decorator`, legacy role-only guard path)
- [ ] Remove compatibility bridge logic in `RolesGuard`
- [ ] Ensure no remaining role-based authorization comparisons
- [ ] Checkpoint complete

## Operational Notes
- Skip tests for now (known widespread breakage during migration).
- Skip lint and typecheck for now (expected broad intermediate errors).
