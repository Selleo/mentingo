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
- [x] Migrate `ai.controller` from `@Roles` to `@RequirePermission(PERMISSIONS.AI_USE)`
- [x] Replace AI role-based thread/retake authorization with permission-based checks
- [ ] Checkpoint complete

## Segment 5: Cleanup
- [ ] Delete legacy role-based auth artifacts (`roles.decorator`, legacy role-only guard path)
- [ ] Remove compatibility bridge logic in `RolesGuard`
- [ ] Ensure no remaining role-based authorization comparisons
- [ ] Checkpoint complete

## Operational Notes
- Skip tests for now (known widespread breakage during migration).
- Skip lint and typecheck for now (expected broad intermediate errors).
