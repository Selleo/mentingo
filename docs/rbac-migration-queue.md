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
- [ ] Migrate remaining controllers from `@Roles` to `@RequirePermission`
- [ ] Replace all `@CurrentUser("role")` usage with permission-driven checks
- [ ] Replace service/repository role comparisons with permission checks
- [ ] Checkpoint complete

## Segment 5: Cleanup
- [ ] Delete legacy role-based auth artifacts (`roles.decorator`, legacy role-only guard path)
- [ ] Remove compatibility bridge logic in `RolesGuard`
- [ ] Ensure no remaining role-based authorization comparisons
- [ ] Checkpoint complete

## Operational Notes
- Skip tests for now (known widespread breakage during migration).
- Skip lint and typecheck for now (expected broad intermediate errors).
