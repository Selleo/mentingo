# Group Manager Business Spec

## Business Overview

Group Manager is a read-only role for line managers, team leads, and client stakeholders who need to monitor training outcomes for specific organizational groups without receiving tenant-wide administration access.

An administrator assigns the role and separately selects the groups the person manages. Current learner membership in any assigned group defines the manager's learner population. Once a learner is in that population, the manager can see all of that learner's training progress, including courses assigned individually or through another group.

## Who Uses It

- HR and L&D administrators assign the role and managed groups from user create/edit screens.
- Team managers monitor learner completion, deadlines, assessment outcomes, learning time, live-training attendance, and certificates.
- Client stakeholders review scoped results and export synchronous XLSX reports without being able to change learning content or learner records.

## Feature Functions

- Assign Group Manager alongside any other system role and select zero or more managed groups.
- Show dashboard completion and deadline-risk widgets calculated only from currently authorized learners.
- Start with a focused dashboard containing the Event calendar, Deadline risks, and Training completion widgets, while preserving each manager's saved custom layout.
- List only courses and development paths with an enrollment for at least one authorized learner.
- Browse full course curricula and lesson content in preview mode without creating progress, quiz attempts, AI Mentor threads, activity, or learning-time records.
- View the name, role description, and profile image of an author whose course is in the manager's current scope.
- View scoped learner progress, learning time, quiz details, task responses, and AI Mentor results.
- Open an authorized learner's quiz or AI Mentor result preview without receiving general user-profile access.
- Calculate average course learning time across every authorized enrolled learner, counting a learner who has not started as zero time.
- View live-training metadata, trainer identity, participant rows, attendance, and aggregate counts restricted to authorized learners.
- View current certificate state for every authorized enrolled learner: not earned, active, expired, or revoked.
- Preview active and expired certificates; another learner's certificate cannot be downloaded or shared.
- Generate synchronous XLSX/statistics reports containing only authorized learners and currently shared managed-group names.

## Authorization and Privacy Rules

- Backend authorization is authoritative. Frontend navigation and hidden controls are usability measures, not security boundaries.
- Manager assignment is separate from learner group membership. Assigning a manager never enrolls that manager in group training.
- Access uses current group membership. Removing a learner from the last shared managed group immediately removes manager access to that learner's data.
- Learners and underlying records are deduplicated across overlapping managed groups.
- Managers see learner name, email, and all group memberships for learners already inside their managed scope. They do not receive Users-directory or learner-profile access.
- A manager with no assigned groups sees empty collections and never receives unrestricted access.
- Out-of-scope object and filter identifiers return not found instead of revealing whether the object exists.
- Course-author profile access is derived from an in-scope course and does not grant access to unrelated user profiles or the Users directory.
- Assessment previews reuse the learner identity already returned by the scoped statistics result; they do not call the Users-directory endpoint.
- Managed-group assignment changes and role removal are activity-logged and revoke active sessions so the new scope is applied after sign-in.
- Permissions from combined roles are additive. If another assigned role independently grants broader access, that broader access remains effective.

## Administration Workflow

The matching user create and edit forms display a separate **Managed groups** section whenever Group Manager is selected. Its multi-select behaves consistently with the Roles selector, and an information tooltip explains that the selected groups define which learners and learning results the manager can view. The ordinary **Groups** field remains learner membership and has no manager-assignment meaning.

Removing the Group Manager role deletes all managed-group assignments. Re-adding the role starts with no assignments. Bulk import accepts the stable `group_manager` role slug but does not import managed-group assignments.

## End-User Experience

Group Managers reuse the existing dashboard, the modern course overview at `/courses`, development-path, calendar, live-training, and course-statistics interfaces. They can open live-training details from the calendar when the training is within their managed scope and use the Sessions tab to review attendance for learners in their managed groups. Their default dashboard places the Event calendar at 4×2 beside Deadline risks and Training completion at 2×2 each; saved personal layouts remain unchanged. The modern overview shows only courses in their managed scope and uses a **Go to course** action instead of learner start/continue actions. Course enrollment, development-path self-enrollment, course-level progress badges inside development paths, payment, and personal **Your progress** controls are hidden, and they cannot enter `/admin/courses` or the admin layout. Course browsing does not start learning-time or progress tracking.

The course-statistics certificate tab shows the effective certificate state, issue/expiry dates in the same day-month-year format used across certificate surfaces, and a preview action where allowed. The preview preserves the organization’s configured certificate background, platform logo, signature, and font color. It is screen-oriented and intentionally has no download or share control; screenshots cannot be technically prevented.
Certificate-table searches are applied by the backend across learner names, email addresses, and localized group names, while retaining the manager's current learner scope. Results are paginated so large learner populations remain responsive.

## Key Technical Context

- The stable role slug is `group_manager`; scoped access is represented by `PERMISSIONS.MANAGED_GROUP_RESULTS_READ`.
- Manager assignments are stored in `group_manager_groups` with tenant isolation and a unique manager/group pair.
- Shared SQL scope helpers first resolve the authorized learner population through current `group_users` membership, then apply it to courses, learning paths, statistics, reports, calendar events, live training, and certificates. Certificate statistics enforce course access in the service layer and return paginated rows.
- User API create/update payloads use `managedGroupIds`; user reads expose localized `managedGroups` separately from learner `groups`.
- Assignment changes use the existing user activity-log/outbox and session-revocation flows.

## Test Evidence

- Unit coverage verifies that manager-only permission is scoped and that a second role's broader permission bypasses only the manager-derived restriction.
- Frontend guard and component coverage verifies that Group Managers use `/courses`, can open live-training details and its scoped Sessions tab, cannot enter the admin layout or `/admin/courses`, cannot self-enroll from development-path cards, do not see course-level learner progress badges there, and do not issue course-only certificate or lesson-sequence requests without the corresponding permissions.
- Backend E2E coverage verifies that a manager can load an in-scope course author's details while an unrelated course author remains forbidden.
- Backend E2E coverage verifies that average learning time uses all scoped enrollments as its denominator, including learners without recorded time, while each learner's total is counted once even when they belong to multiple groups.
- Backend E2E coverage verifies that a manager can load an authorized learner's completed quiz, including unanswered free-text questions with schema-valid identifiers, and receives one assessment row when that learner belongs to overlapping managed groups. Frontend coverage verifies that an unanswered fill-in-the-blank response is labeled explicitly instead of appearing as an unexplained empty field.
- Backend E2E coverage verifies that certificate searches match scoped learner email and localized group names and return an empty result, rather than an authorization error, when an in-scope course has no matches.
- Course-statistics tab coverage verifies certificate visibility remains available independently of AI Mentor configuration.
- API and web typecheck/lint validate the cross-app schemas, generated client, role constants, scoped queries, assignment forms, navigation, and certificate preview contract.
