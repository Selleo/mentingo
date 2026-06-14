# Group Management Business Spec

## Business Overview

Group management lets HR and L&D admins represent teams, departments, cohorts, or other learner segments inside Mentingo. Groups become reusable building blocks for enrollment, filtering, reporting, and user organization.

For business users, the feature reduces repetitive learner administration. Instead of managing course access one person at a time, admins can maintain stable groups and use them across learning operations.

The main workflow starts in the admin group list. An admin browses or searches groups, creates a new group, edits group details, manages language variants, and removes groups that are no longer needed.

## Who Uses It

- HR admins use groups to mirror company teams and departments.
- L&D admins use groups to assign training to cohorts.
- Tenant admins use groups to keep learner administration organized.
- Reporting users benefit from group-based filtering when reviewing enrollment or progress.

## Feature Functions

- Browse groups with pagination, keyword search, sorting, row selection, and bulk actions.
- Create groups with a base language, localized name, and localized characteristic.
- Update existing group details and manage translated language variants.
- Delete one group or multiple selected groups from the admin list.
- Assign groups to users through the group-user relationship.
- Retrieve groups attached to a course so course enrollment can show group assignments.

## End-User Value

Groups make learner administration scalable. HR and L&D teams can align Mentingo with the organization structure, target courses to the right people, and reduce manual work when teams change.

Localized group details also help multilingual organizations keep admin-facing labels understandable across supported languages.

## How It Works

Admins open the group list, search or sort the table, and select a group for editing or deletion. Creating or editing a group uses a localized form, with base language and available language variants determining which labels can be maintained.

Group records are also used outside the group section. Course enrollment can list groups already enrolled in a course, and user administration can assign users to groups. This makes the group object a shared organizational primitive rather than a standalone directory.

## Key Technical Context

- Frontend group screens live under `apps/web/app/modules/Admin/Groups`.
- Admin routes are `/admin/groups`, `/admin/groups/new`, and `/admin/groups/:id` in `apps/web/routes.ts`.
- Route access requires `GROUP_MANAGE`; API reads use `GROUP_READ` and mutations use `GROUP_MANAGE`.
- API behavior is centered in `apps/api/src/group/group.controller.ts` and `apps/api/src/group/group.service.ts`.
- Group content is localized through base language and available locale handling.
- Group mutations publish outbox events such as create, update, delete, and user-group enrollment events.

## Test Evidence

Frontend E2E tests in `apps/web/e2e/specs/groups` cover browsing and sorting groups, selecting ranges, opening group details, creating valid groups, blocking invalid creation, updating groups, canceling edits, and single or bulk deletion.

Backend E2E tests in `apps/api/src/group/__tests__/group.controller.e2e-spec.ts` cover authentication, permission enforcement, group listing, pagination, sorting, keyword filtering, and reading group details.
