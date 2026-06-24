# Group Management Business Spec

## Business Overview

Group management lets HR and L&D administrators model teams, departments, cohorts, or learner segments inside Mentingo. Groups become reusable building blocks for user organization, course enrollment, filtering, localization, and reporting.

For business users, groups reduce repetitive learner administration. Instead of assigning every course or filtering every report person by person, teams can maintain stable groups and reuse them across learning operations.

The main workflow starts in the admin group list. An administrator browses or searches groups, creates a new group, edits localized details, assigns users to groups through user management, and removes groups that are no longer needed.

## Who Uses It

- HR administrators mirror teams, departments, or locations so learner administration matches the organization.
- L&D administrators assign courses to cohorts by using groups in enrollment workflows.
- Tenant administrators maintain group names and characteristics in supported languages.
- Reporting and course managers use group membership to filter learners and understand assignment context.

## Feature Functions

- Browse, search, sort, paginate, and select groups from the admin list.
- Create groups with a base language, name, and characteristic.
- Edit group details in the selected language.
- Add, remove, and switch group language variants while protecting the base language.
- Delete one group or bulk delete selected groups.
- Assign users to groups from user-management workflows.
- Use groups in course enrollment and enrolled-user filtering.

## End-User Value

Groups make learner administration scalable. HR and L&D teams can target training to the right people, keep assignments aligned with real organizational structure, and reduce manual updates when employees move between teams or cohorts.

Localized group details also help multilingual organizations keep administrative labels understandable for teams working in different interface languages.

## How It Works

Admins manage groups from `/admin/groups`. The list supports search, sorting, row selection, and bulk actions. Creating or editing a group uses a localized form, so the admin can maintain the group label and characteristic in the appropriate language.

Groups are reused outside the group section. User management can set a user's group membership, course enrollment can assign whole groups to courses, and enrolled-user views can show whether a learner is enrolled directly or through a group.

When group membership changes, Mentingo can apply the impact to group-enrolled courses. This keeps group-driven learning assignments aligned with current membership instead of requiring administrators to manually revisit each course.

## Key Technical Context

- Frontend group screens live under `apps/web/app/modules/Admin/Groups`.
- Admin routes are `/admin/groups`, `/admin/groups/new`, and `/admin/groups/:id`.
- API behavior is centered in `apps/api/src/group/group.controller.ts` and `apps/api/src/group/group.service.ts`.
- Group reads use `PERMISSIONS.GROUP_READ`; group mutations use `PERMISSIONS.GROUP_MANAGE`.
- Group content is localized through base language and available locale handling.

## Test Evidence

- Web E2E coverage verifies browsing, sorting, range selection, opening group details, creating valid groups, blocking invalid creation, canceling creation/editing, updating groups, and single or bulk deletion.
- API E2E coverage verifies authentication and permission enforcement, listing, pagination, sorting, keyword filtering, details, user groups, creation with language metadata, localized updates and fallback, language add/base/delete rules, deletion, bulk deletion, and automatic enrollment impact when users are assigned to groups.
