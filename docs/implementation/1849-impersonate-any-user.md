# #1849 Allow Managing Admins To Impersonate Any User

Issue: https://github.com/Selleo/mentingo/issues/1849

Suggested branch: `jh_feat_1849_impersonate_any_user`

## Summary

Allow a managing-tenant administrator to start Support Mode as any active user in another active tenant. The tenant-list action and selector must use user-oriented wording, keep administrators as the default view, provide an all-users view, and help operators broaden an unsuccessful administrator search without retyping it.

This is an extension of the existing Support Mode flow rather than a new impersonation system. Support sessions already persist a generic `targetUserId`, and authentication already resolves the selected user's real roles and permissions. The implementation must remove the remaining administrator-only restrictions without granting the source managing admin's permissions to the selected target user.

Estimated effort: 2-3 engineering days, including API and web changes, generated-client regeneration, localization, automated coverage, business-spec updates, and manual validation. No database migration is expected.

## Goals

- Let a managing admin impersonate any active, non-deleted user in another active tenant.
- Preserve the target user's effective roles, permissions, tenant data scope, and normal product experience.
- Keep administrators as the default selector view for the fastest existing support workflow.
- Make learners, content creators, trainers, and custom-role users discoverable through search.
- Keep the existing Support Mode banner, expiry, revocation, activity logging, account restrictions, and exit flow.

## Non-Goals

- Do not let ordinary tenant admins or users initiate cross-tenant impersonation.
- Do not impersonate archived or deleted users, users from another target tenant, users in the current managing tenant, or users in an inactive tenant.
- Do not elevate the selected user's permissions or merge them with the source managing admin's permissions.
- Do not introduce a new permission, support-session table, migration, queue, outbox event, or background job.
- Do not redesign the tenant table, Support Mode banner, session duration, grant duration, callback, or exit flow.
- Do not add group filtering or other general user-management filters to this focused selector.

## Product Decisions And Constraints

- The tenant-row action label is **Impersonate user**, replacing the admin-specific label.
- The popover contains two tabs:
  - **Admins**: default tab; implicitly filters to users with the admin role.
  - **All users**: displays all eligible users.
- Search remains server-side, debounced, and matches first name, last name, or email.
- If a non-empty search has no results in the Admins tab, the centered empty state includes a **Search all users** CTA.
- The CTA switches to All users and preserves the current search phrase.
- Each result displays the user's avatar, full name, email, and assigned role labels. Multi-role users appear only once.
- Selecting a role matches users who have that role among any of their assignments.
- Changing the raw search value or tab clears the selected target user. Closing the popover resets it to Admins, an empty search, and no selection.
- Existing pagination and explicit **Load more users** behavior remain.
- Visible strings must be added to every supported web locale.
- Existing API permissions and `ManagingTenantAdminGuard` remain authoritative. Frontend visibility is not an authorization control.

## Current Architecture

- `apps/api/src/storage/schema/index.ts` already stores `supportSessions.targetUserId`; no schema change is required.
- `apps/api/src/super-admin/tenants.controller.ts` exposes the support-user list and session creation under the existing `tenant.manage` and managing-tenant guard.
- `apps/api/src/support-mode/support-mode.repository.ts` currently restricts list, count, and target lookup queries to `SYSTEM_ROLE_SLUGS.ADMIN`.
- `apps/api/src/support-mode/support-mode.service.ts` currently treats a missing admin-scoped lookup as `supportMode.errors.targetAdminRequired`.
- `apps/api/src/auth/auth.service.ts` already loads the target user's effective role slugs and permissions, but then explicitly rejects targets without the admin role.
- `apps/web/app/modules/SuperAdmin/SupportModePopover.tsx` already owns open state, debounced search, infinite pagination, selection, and session submission.
- `apps/web/app/api/queries/super-admin/useSupportUsers.ts` already provides the server-state boundary for the selector.
- `apps/web/e2e/specs/tenants/support-mode.spec.ts` and `apps/web/e2e/specs/settings/support-mode.spec.ts` cover the current administrator-target flow, banner, navigation restrictions, exit, and settings restrictions.
- `docs/specs/support-mode-business-spec.md` is the authoritative business overview and must be updated with the changed behavior and test evidence.

## UI Direction

Keep the existing popover size, command-list pattern, footer actions, and tenant-row placement.

Recommended vertical structure:

1. Tabs spanning the popover width: Admins and All users.
2. Search input shared by both tabs.
3. Role select shown only in All users, directly below the search input.
4. Scrollable result list with avatar, identity, role labels, and selected checkmark.
5. Contextual empty state or Load more action.
6. Existing Cancel and Proceed footer.

Empty-state behavior:

- Loading: show the existing centered loading treatment with scope-neutral wording.
- Admins without a search: **No active admin users found.** Do not show the broadening CTA.
- Admins with a search and no results: explain that no admins match, then show **Search all users**.
- All users without a result: **No active users found.**
- The broadening CTA is not shown in All users because there is no broader selector scope.

Role display rules:

- Translate known system-role labels through the existing role-label helper behavior.
- Display custom role names returned by the API.
- Keep result rows compact; role badges may wrap within the row but must not push the selection checkmark out of view.

No external mockup or competitor research is required. The change is a focused extension of existing Mentingo tabs, select controls, command lists, avatars, badges, and empty-state patterns.

## Routing And Frontend Structure

- Do not add or change routes. The feature remains inside `/super-admin/tenants`.
- Extend `SupportModePopover.tsx` with controlled selector scope and contextual empty-state state.
- Keep user-list fetching in `useSupportUsers.ts`; include `scope`, `tenantId`, `perPage`, and debounced `search` in its query key.
- Add one target-tenant support-roles query hook under `apps/web/app/api/queries/super-admin/`, using the regenerated `ApiClient.api...` method.
- Reuse `apps/web/app/components/ui/tabs.tsx`, the existing select primitive, `UserAvatar`, buttons, and available badge components.
- Reuse or narrow the existing `getRoleLabel` behavior rather than duplicating system-role translation mappings.
- Add stable handles in `apps/web/e2e/data/tenants/handles.ts` for both tabs, the all-users CTA, and user role labels where assertions require them.
- Keep the selected ID as local UI state. Server results, roles, loading state, pagination, and errors remain TanStack Query state.
- Do not invalidate queries after starting a support session because the mutation redirects to the target tenant and does not change selector data.

## Backend And API Plan

### Support-user list

Extend:

`GET /api/super-admin/tenants/:id/support-users`

Query contract:

- `page?: number`, default `1`.
- `perPage?: number`, default `20`.
- `search?: string`, trimmed before use.
- `scope?: "admins" | "all"`, default `"admins"` for backward compatibility.
- `roleSlug?: string`, applied only when `scope=all`; the web client omits it for All roles.

Response item contract:

- Preserve `id`, `email`, `firstName`, `lastName`, `label`, and `profilePictureUrl`.
- Add `roles: Array<{ slug: string; name: string; isSystem: boolean }>`.
- Return every eligible user once, regardless of their number of roles.

Repository behavior:

- Start from active, non-deleted users in the requested target tenant.
- Use a correlated `EXISTS` condition for Admins scope and explicit role filtering instead of filtering the main result through a multiplying role join.
- Aggregate role metadata independently for each returned user.
- Count distinct eligible users using the same scope, role, tenant, active, deleted, and search conditions as the data query.
- Preserve deterministic ordering by first name, last name, email, and user ID as the final tiebreaker.
- Continue using `DB_ADMIN` because this is a deliberate, guarded cross-tenant support operation.

### Target-tenant roles

Add:

`GET /api/super-admin/tenants/:id/support-roles`

- Protect it with the same controller-level permission and managing-tenant guard.
- Return target-tenant role metadata as `{ id, slug, name, isSystem }`.
- Include system and custom roles.
- Reuse the existing system-role-first ordering: admin, content creator, trainer, student, then custom roles alphabetically.
- Do not reuse `/api/user/roles`; that endpoint intentionally resolves roles for the caller's current tenant.

### Session creation and token exchange

- Generalize admin-specific repository, service, schema, and type names to support-user names.
- Replace `findSupportAdminUserById` with a target-tenant lookup that only requires the user to be active and non-deleted.
- Replace `supportMode.errors.targetAdminRequired` with a generic target-user error such as `supportMode.errors.targetUserRequired`.
- Remove the admin-role assertion during token creation.
- Continue deriving token `roleSlugs` and `permissions` from the selected target user through `PermissionsService.getUserAccess(..., DB_ADMIN)`.
- Retain checks for an existing source tenant, existing target tenant, different source and target tenants, active target tenant, unarchived target user, matching target tenant, unexpired grant, and active support session.
- If the target user's roles change after a session is created but before the grant is consumed, use the roles and permissions effective at token creation time.
- Existing current-user resolution continues to return the target user's identity and current access while marking the session as Support Mode.

### API compatibility and generated artifacts

- Default omitted `scope` to Admins so an older web client does not unexpectedly expose all users.
- Keep the session creation body unchanged: `{ targetUserId }`.
- Update TypeBox request and response schemas before regenerating Swagger and the web client.
- Do not hand-edit `apps/api/src/swagger/api-schema.json` or `apps/web/app/api/generated-api.ts`.

## Tenant, Permission, And Security Rules

- Only an authenticated user with `PERMISSIONS.TENANT_MANAGE` from a tenant whose `isManaging` flag is true may list support users, list support roles, or create sessions.
- The server must resolve the target user from the path tenant ID and body user ID together. Never trust a client-supplied role, permission list, tenant ID, or selector scope as session authority.
- A direct request using an archived, deleted, missing, or different-tenant target user ID must fail even if that user appeared in an older selector response.
- Inactive target tenants and the source managing tenant remain invalid targets.
- The selected user's actual roles and permissions are authoritative. Support Mode must not turn a learner or custom-role user into an admin.
- Existing protections that hide personal profile/account settings, hide super-admin navigation, suppress user-scoped activity events, show the support banner, and provide a controlled exit remain active for every target role.
- Existing Support Mode login activity must continue to identify the original impersonating operator while retaining the target user and tenant context.

## Implementation Checklist

### Backend

- [x] Add `scope` and `roleSlug` query schemas to the support-user endpoint.
- [x] Add generic support-user and support-role response schemas and exported types.
- [x] Rename admin-specific support-user service and repository types/methods.
- [x] Implement a shared eligible-user condition for tenant, archived, deleted, search, scope, and role filtering.
- [x] Change user retrieval and count queries to avoid multi-role duplicates.
- [x] Return assigned role metadata with each selector user.
- [x] Add the guarded support-roles endpoint and target-tenant role query.
- [x] Generalize target-user validation during support-session creation.
- [x] Remove the admin-only assertion during support-token creation.
- [x] Replace admin-specific support-mode error keys with user-generic keys.
- [x] Update focused support-mode service tests.
- [ ] Add backend E2E coverage for authorization, filtering, and forged targets.
- [x] Regenerate Swagger and the web API client through existing scripts.

### Frontend

- [x] Change the tenant-row action label to Impersonate user.
- [x] Add Admins and All users tabs, with Admins as the reset/default state.
- [x] Extend `useSupportUsers` parameters and query keys with scope and role.
- [x] Add the target-tenant support-roles query hook.
- [x] Add the All roles filter to the All users tab.
- [x] Render localized system roles and target-tenant custom role names in result rows.
- [x] Add the Search all users CTA for unsuccessful non-empty Admins searches.
- [x] Preserve search when the CTA switches tabs.
- [x] Clear selection on search, scope, and role changes.
- [x] Add contextual loading and empty-state translations to every locale.
- [x] Extend stable Playwright handles and the support-mode flow helper.
- [ ] Add focused component/unit coverage for selector state behavior where practical.
- [x] Extend Playwright coverage to impersonate a non-admin user.

### Documentation

- [x] Update `docs/specs/support-mode-business-spec.md` to describe impersonating any active target user, selector filtering, and actual target permissions.
- [x] Update the spec's test-evidence section after validation.

## Edge Cases

- A user has multiple roles: return one row, show all roles, and match the row when any assigned role equals the selected filter.
- A user has no assigned roles: include them in All users because the requirement is any active user; show no role badge and expect their effective permissions to be empty.
- A custom role lacks dashboard access: the existing permission-based default redirect chooses the first available supported destination and ultimately falls back to Settings. Verify that Support Mode still renders a usable allowed surface and exit control.
- The trainer role is unavailable for the target tenant: omit it naturally because support roles come from that tenant's persisted roles.
- The selected user becomes archived, deleted, or moves out of eligibility before submission or grant consumption: reject session creation or token exchange server-side.
- The selected user's roles change between selection and session creation: ignore stale client role data and derive current server-side access.
- The Admins tab search is empty and there are no admins: show the empty state without the Search all users CTA because there is no search phrase to carry over.
- Search returns no admins but does return other users: the CTA switches scope and lets the all-users request determine the actual results; do not prefetch or claim that matches exist.
- The role filter returns no users: preserve the selected filter and search so the operator can adjust either intentionally.
- Pagination is active when scope, search, or role changes: the TanStack Query key changes and pagination restarts at page one.
- The popover closes during loading or submission: reset local selector state; retain existing mutation-level submission protection.
- A forged request supplies `scope=all` without managing-tenant authority: controller guards reject it before repository access.

## Tests And Validation

### Backend tests

- Default omitted scope returns only active admin-role users.
- All scope returns active students, content creators, trainers, admins, custom-role users, and roleless users.
- Role filtering matches users with at least one matching role.
- Multi-role users appear once and pagination totals remain correct.
- Search works with both scopes and alongside a role filter.
- Archived, deleted, missing, and different-tenant users are excluded from lists and rejected during session creation.
- A managing admin can create and consume a support session for a non-admin target.
- The resulting current user and token contain the target user's identity, roles, and permissions without source-user elevation.
- Missing `tenant.manage`, a non-managing source tenant, the current tenant, and an inactive target tenant remain rejected.

### Frontend tests

- Popover opens on Admins and resets to Admins after close/reopen.
- Search, scope, and role are included in the correct generated-client calls.
- The role filter is only visible in All users.
- The Search all users CTA only appears for a non-empty unsuccessful Admins search.
- CTA switching preserves search and clears selection.
- Changing search or role clears selection and disables Proceed.
- Multi-role labels and custom-role names render correctly.
- Load more continues to work independently for each query-key combination.

### Playwright and manual QA

- Extend `apps/web/e2e/specs/tenants/support-mode.spec.ts` with a target student or other non-admin user created through existing tenant/user factories.
- Verify the operator lands in the target tenant, sees the support banner, receives only the target user's navigation and permissions, cannot access super-admin routes, and can exit back to the managing tenant.
- Verify the existing admin-target flow still passes.
- Verify narrow popover layout, wrapped role badges, keyboard tab/select navigation, and centered empty-state CTA.
- Verify all supported locale files contain the new keys and the English wording is Impersonate user, Admins, All users, All roles, and Search all users.

### Commands

- `pnpm generate:client`
- Run the narrow focused API support-mode tests first.
- Run the narrow focused web unit/component tests first.
- Run the support-mode Playwright specs serially against the shared test environment.
- `pnpm lint-tsc-api`
- `pnpm lint-tsc-web`
- `git -c core.whitespace=cr-at-eol diff --check`

## Acceptance Criteria

- A managing admin can select and successfully enter Support Mode as any active user in another active tenant.
- The selector defaults to Admins and provides All users with an All roles/custom-role-aware filter.
- An unsuccessful admin search offers a centered Search all users CTA that preserves the search.
- The action and selector contain no user-facing Impersonate admin or Enter as admin wording.
- Non-admin targets retain their actual roles and permissions; they do not receive admin or managing-tenant access.
- Server-side authorization rejects forged, archived, deleted, cross-tenant, current-tenant, inactive-tenant, and unauthorized requests.
- Multi-role users are not duplicated and pagination totals are accurate.
- Existing Support Mode expiry, banner, restrictions, activity logging, and exit behavior continue to work.
- Generated contracts, all locale files, automated tests, and the Support Mode business spec are updated in the same implementation.
