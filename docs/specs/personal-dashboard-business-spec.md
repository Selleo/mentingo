# Personal Dashboard Business Spec

## Business overview

The personal dashboard turns Mentingo's home route into a compact, permission-aware action panel for learning and training operations. It combines personal actions, such as AI Mentor practice and To-do tasks, with the learning or management information the signed-in user is allowed to access.

The dashboard is personalized without making users manage a separate save workflow. Visibility changes persist immediately; card order and supported size changes persist after the interaction completes. The localized page title is **Twój dashboard**.

## Who uses it

- Students receive learner-facing cards for assigned learning, completion, certificates, calendar events, AI Mentor, and personal To-do tasks when their permissions and tenant features allow them.
- Administrators start with management cards rather than learner cards. If an administrator also has learner permissions, those cards remain available in the widget picker but are hidden by default.
- Content creators receive the same management card capabilities as administrators where permissions allow them. Course-derived statistics remain restricted by the API to courses they own or manage unless they also have global scope.
- Trainers start with the same compact AI Mentor, To-do, and Calendar row. Multi-role users restore the highest-priority management profile (Admin, Content Creator, then Trainer) before the Student profile, so learner cards do not unexpectedly become visible for administrators. Every additional permitted card remains available in the widget picker, and canonical widget IDs prevent duplicate calendars or other shared capabilities.

Frontend visibility is not authorization. Every data endpoint independently enforces tenant, permission, feature, and actor scope.

## Dashboard composition

The backend exposes one canonical widget catalog:

- `ai_mentor_practice`
- `todo_list`
- `event_calendar`
- `deadline_risks`
- `training_completion`
- `continue_learning`
- `required_courses`
- `course_completion`
- `certificates`

The retired unfinished-courses card is not available. Restore default uses explicit role profiles for both order and size. Every profile starts with AI Mentor at `3x2`, Calendar at `4x2`, and then To-do at `3x2`. Management profiles continue with Deadline Risks at `3x2` and Training Completion at `2x2`, so that operational band fills all eight desktop columns (`3 + 3 + 2`). Student profiles instead pair To-do `3x2`, Continue Learning `3x2`, and Required Courses `2x2`, followed by `2x2` Course Completion and Certificates. Restored profiles never use a one-row card; compact one-row sizes remain a manual personalization option where supported. Administrator and Content Creator defaults contain management cards only, filtered by actual permissions. Temporarily inaccessible widgets remain in saved preferences so they can return if the user regains access.

Cards use semantic sizes from `1x1` through focused `3x2` and `4x2` spans. Each widget advertises only the sizes its content can use well. The grid uses two, four, or eight square columns, so every dimension preserves the same physical unit while content remains constrained to its allocated area.

On narrow screens below the `md` breakpoint, saved semantic sizes remain the user's preference while the visual layout stays usable: one-column cards use one mobile column, and wider `2x`, `3x`, or `4x` cards clamp to the full two-column mobile grid. From `md` upward, the saved `3x2` and `4x2` widths resume their full spans. This prevents implicit mobile columns from collapsing neighboring cards into unusably narrow tiles without changing the user's saved dashboard settings.

Every card shares the same compact shell: organization-color icon, title, divider, fixed overflow behavior, and an optional top-right navigation icon. Navigation icons stay visually stable on hover; they do not slide or gain a competing hover container. The drag preview reuses this header treatment instead of showing a separate icon badge.

Calendar is a required card whenever the user has calendar access and the tenant calendar feature is enabled. It remains visible in the dashboard and appears in the widget library with a disabled switch and a **Required** label; users can still reorder or resize it within its supported calendar sizes, but cannot hide it.

## Personalization and persistence

`GET /api/settings/dashboard` returns the user's normalized layout and permission-filtered catalog. Each saved item contains:

```yaml
type: canonical widget type
size: 1x1 | 2x1 | 1x2 | 2x2
visible: boolean
```

Catalog entries also indicate whether a widget is always visible. The API normalizes required widgets to `visible: true` and restores an omitted required widget during saves, so the rule is enforced even if an older client submits an incomplete layout.

Array order is display order. The dashboard subdocument also carries `schemaVersion: 2` and a monotonic `revision`.

`PUT /api/settings/dashboard` atomically replaces the current user's dashboard preferences using an expected revision. Visibility changes are optimistic and automatic; valid reorder and resize operations save on completion. A serialized client queue prevents overlapping changes from overwriting one another. On a revision conflict, the client refetches and replays the latest local operation once.

There is no global Save or Cancel action and no drag-instruction banner. Layout edit mode exposes card order, size, visibility, and reset controls; **Done** only exits layout editing because the changes are already saved. Reset uses confirmation and persists the current permission-aware defaults through `POST /api/settings/dashboard/reset`.

Because the semantic grid had not shipped to production, schema version 2 treats every incompatible stored layout as unset. Those users immediately receive the current role-specific default without having to reset or save it themselves. No database backfill is required; the version 2 layout is persisted on the next dashboard change. Once a version 2 layout exists, temporarily inaccessible widgets remain preserved in storage so permission changes do not erase the user's choices.

## Card behavior

### AI Mentor practice

The AI Mentor card reuses the existing daily-practice lifecycle and chat transport. When no practice exists, users can describe a scenario directly in the card. A plus button opens scenario suggestions; selecting one fills the composer without submitting it. The empty composer cycles example prompts while unfocused and respects reduced-motion preferences.

Creating, queued, generating, failed, active, and completed states remain in place inside the card. Once active, the card shows the conversation in an internally scrollable region, keeps the latest message in view, and provides a text composer plus a top-right CTA to the full practice. The inline chat and full practice synchronize through the same thread-message query cache, so navigation cannot briefly hydrate an older conversation. Voice and detailed evaluation stay on the full AI Mentor page.

The card uses one visually flat content flow rather than nested cards. It supports `2x2` and the wider `3x2` option; role-based restored layouts use `3x2`. It never exposes a one-row variant and does not display redundant statements such as “today's attempt” or “the conversation is saved.”

### To-do tasks

To-do is a personal, tenant-scoped task list backed by `todo_tasks`. Users can add tasks, complete or uncomplete them, rename them inline, delete them, and reorder them at any time; these controls do not depend on dashboard layout edit mode. It supports compact `2x1`, standard `2x2`, and wider `3x2` layouts while keeping the task list independently scrollable.

Active tasks appear before completed tasks. Completion moves a task to the end of the completed section, and reopening it moves it to the end of the active section. DnD reordering is constrained to the current section. Nested task drag events are isolated from the outer dashboard sortable so moving a task cannot move its card.

The API exposes self-scoped list, create, update, delete, and transactional reorder operations under `/api/todo-tasks`. Public payloads never accept a tenant or user ID. Titles are trimmed and limited to 200 characters; each user can keep up to 100 tasks.

### Event calendar

There is one `event_calendar` card. Its supported `4x2` and `4x3` layouts give the complete six-week month and an independently scrollable selected-day and upcoming-event region enough room to remain visible together. `4x2` is the default.

The header CTA opens `/calendar`. Calendar is removed from user-facing sidebar navigation, while direct route access and its existing permission guard remain. Event visibility continues to use the role-aware calendar service.

### Deadline risks

The risk card displays affected courses directly rather than first presenting overdue/due-soon option cards. It supports `2x1`, `2x2`, and `3x2` layouts, defaulting to `2x1`. Courses are loaded incrementally and can be ordered by most or least urgent from the header. The card keeps course rows neutral so selecting a course is the clear primary action.

Selecting a course opens a sortable repo-native Table of the course groups that own an overdue or approaching deadline. The columns are Group, Learners, Deadline, and Status. The entire group row toggles its enrollment-linked learners by pointer or keyboard. Search matches group or learner names, status filtering distinguishes overdue and due-soon groups, and selected filter options use a primary-tinted background without a dot/check marker. Changing filters or sorting keeps the same course's previous rows visible until the updated result arrives instead of replacing the table with a loader or skeleton. Groups are loaded incrementally. The responsive dialog uses the mobile drawer presentation on narrow screens and the same constrained centered width pattern as AI Mentor dialogs on desktop. It omits the redundant course-attention subtitle and keeps constant padding and hidden horizontal overflow. Its pointer, click, and keyboard events do not bubble to the sortable card below it.

The backend paginates distinct courses at `/api/statistics/dashboard/deadline-risks/courses` and course-specific deadline groups at `/api/statistics/dashboard/deadline-risks/courses/:courseId/groups`. It verifies course access before returning groups and their learners, and applies administrator versus owned/manageable-course scope server-side. Deadlines are derived from current `group_users + group_courses` membership rather than the enrollment's single `enrolledByGroupId`, so a learner in multiple groups can contribute to every applicable course-group deadline.

### Certificates

The certificate card shows certificate records immediately in an internally scrollable list instead of counters or active/overdue grouping. Additional records load as the user reaches the end. Selecting a row opens the same shared certificate preview modal used by the course view rather than navigating to its course. It includes the tenant logo and background, persisted certificate font color and signature, download, and share controls. The dashboard calls the current-user `/api/certificates/dashboard` endpoint and never supplies another user's ID.

### Learning and statistics

Continue Learning, Required Courses, and Course Completion remain permission-gated learner views. Required Courses derives mandatory assignments and the earliest applicable deadline from current group membership, including for course managers who are not the course author. Group enrollment excludes only the course author rather than every user with course-management permissions. Training Completion and Deadline Risks remain independently loaded management views. Visible chart legends are removed to reduce card noise; tooltips may extend beyond the chart card without being clipped, while accessible text summaries preserve the information.

Each card owns its loading, error, retry, empty, and populated states. A failed card does not prevent the rest of the dashboard from loading.

## Permissions and data boundaries

- AI Mentor requires `ai.use` and a configured tenant AI runtime.
- To-do requires `todo_task.manage_self`.
- Calendar requires `calendar.read` and the calendar feature.
- Deadline Risks and Training Completion require `statistics.read`; repository queries choose tenant-wide or owned/manageable-course scope from the actor's permissions.
- Learner course cards require assigned-course read access.
- Certificates require certificate read access.

Role profiles only establish initial order and visibility. The permission-filtered server catalog is authoritative for what a user may submit or render. Unknown types, duplicates, unavailable widgets, and unsupported sizes are rejected using own-property/set membership semantics.

## Accessibility and interaction quality

- Mouse, delayed-touch, and keyboard dashboard sorting remain supported.
- Reduced-motion preferences disable non-essential card and placeholder movement.
- Fixed grid cells use internal scrolling and do not resize around loading or long content.
- Calendar dates expose localized labels and selected state.
- Chart information remains available without relying only on color.
- Icon-only controls have accessible names, and destructive To-do actions remain explicit.

## Implementation evidence

The branch includes backend coverage for dashboard normalization, catalog filtering, revision conflicts, self-scoped To-do operations, current-user certificates, deadline course/student scope, and tenant RLS. Frontend coverage exercises grid packing, persisted wide-span clamping at a narrow viewport, and the primary card behaviors, with Playwright flows added for layout persistence, navigation, AI Mentor, deadlines, certificates, and To-do interactions.

The latest user-directed refinement pass was implemented without rerunning automated checks. The final validation run remains intentionally deferred until requested.
