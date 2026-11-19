# Reports

Status: first-release implementation; browser and database integration checks pass. Capacity validation is recorded below.

## Business Overview

Reports help HR and L&D answer “How is the organisation progressing?” Users review organisation learning, development-path progress, course performance, and individual learner progress, following the four views in `mentingo-reports-demo.html`.

Users select an organisation or group population, combine conditions, and review metrics and results calculated from the same filtered learning. They can save personal or organisation-wide configurations and export complete filtered results as PDF or spreadsheets.

## Who Uses It

- Users with organisation-wide reporting access compare learning progress across groups and manage shared configurations for their organisation.
- Group managers review learning for members of their managed groups, save personal configurations, and reuse shared configurations within their permitted population.

## Feature Functions

- Compare the eight most popular courses in a chosen period and the eight courses without learner activity for the longest time, to prioritize a human review for updating or archiving.
- Review organisation, development-path, course, and learner progress through four report views.
- Organisation overview: matching learners, learners active in the last 30 days (with their share), course completion rate and average quiz score; completed / in-progress / not-started enrollment shares by course or group; learning outcomes including AI Mentor conversations on matching courses; monthly active learners over the last 12 months; and a learning funnel (in scope, logged in, started learning, completed a course).
- Development paths: one card per matching path with its course count, learners, completed-course share and average progress, opening that path's learning records; plus the most popular and longest inactive paths for the chosen period.
- Course performance: one row per matching course with enrollments, completion rate, average progress and average quiz score, followed by the most active and longest unused courses.
- Learner progress: one row per matching learner and course or path, with the learner's groups, status, progress, quiz results and last activity.
- Course, development-path and learner views compare every visible subject until one is picked. Path and course views list learning records only once a single path or course is picked; the organisation overview always lists them.
- Choosing a view opens it immediately with the applied scope and conditions; when a condition does not apply to the new view, the report waits until it is adapted and applied.
- Scope analysis to selected groups, including their members' individually assigned learning and learning assigned through other groups.
- Combine applicable conditions using AND/OR groups with one level of nesting, including status, content, learner, progress, dates, quiz results, certificates, and last activity. Every matching operator has its excluding counterpart (is / is not, is any of / is none of, contains / does not contain, between / not between, is empty / is not empty); excluding conditions never match a record without a value.
- Recalculate headline metrics and results from all active conditions, with clear scope and condition labels.
- Save personal and organisation-wide configurations for reuse with current data and current access rights.
- Preserve compatible conditions when changing views, explain incompatible conditions, and reset with one button, which clears the picked subject, groups, conditions and popularity period while keeping the current view.
- Export every matching result and headline metrics, together with scope, conditions, generation time, and date meaning, as PDF or spreadsheets.
- Respect reporting access throughout selectors, search, results, metrics, configurations, and exports.

## End-User Value

HR and L&D gain a consistent view of learning progress across the organisation and its groups. Reusable configurations reduce repeated setup, and clearly defined metrics make comparisons easier to interpret. Managers can inspect the learning population they are responsible for and share interpretable exports with stakeholders.

## How It Works

The user opens one of the four report views, selects groups when needed, and adds conditions using “match all” or “match any” groups. Conditions run inside the selected population and the viewer's permissions. Related course conditions must match the same enrollment: Safety completed plus Leadership in progress does not match Safety in progress.

Every active filter affects headline metrics, tables, and exports. The one exception is the course count, which shows how many courses are on the platform within the viewer's permissions, excluding drafts and archived courses. Overall totals count a learner and their course enrollment once across overlapping groups; individual group breakdowns can overlap. Empty results show zero counts and “—” for undefined rates and averages.

Organisation course completion rate is completed course enrollments divided by total matching course enrollments. Course progress uses completed lessons divided by total lessons; path progress uses completed courses divided by total courses. A path with started learning can be in progress with zero completed courses. Empty courses and paths are not automatically complete.

Average quiz score averages available quiz scores within an enrollment, then weights scored enrollments equally for the organisation metric. Unscored quizzes and AI Mentor grades are excluded. Total quiz attempts sum across a course's quizzes. Score comparisons exclude missing scores; explicit missing-score and missing-completion-date conditions are available.

Last activity includes recorded content openings, quiz submissions, and lesson completions. Active learners are distinct matching learners with activity in the last 30 days, displayed explicitly in the label. Each quiz uses its latest submitted, graded attempt; attempt totals include all submitted attempts. Date ranges include complete calendar days in the saved timezone.

### Course activity and popularity

Path activity applies the same rules to development paths: a path's popularity counts distinct matching learners with recorded activity on its courses in the period, and its inactivity uses the latest such activity across all dates. Monthly active learners use the same recorded-activity signals in the report timezone. The funnel's "logged in" step counts matching learners with a recorded login; tenants whose activity log retention is shorter than their learners' history will under-count it.

HR and L&D choose a popularity period in the existing report, keeping the applied group, learner, course, path and learning conditions. Two horizontal bar charts rank courses across **all** matching records, not just the table page. The initial popularity period is the last 30 calendar days; both endpoints include the entire date in the report timezone. Quick presets select the last 7, 30 or 90 days; a custom range can also be applied. Headline tiles summarize the most popular course, the longest gap without activity and the number of never-used courses. Inactivity bars are banded as under 30 days, 30–89 days and 90+ days, each with a visible legend label. Changing this period changes only these charts, not table filters, saved configurations or exports.

**Most popular** counts distinct matching learners with at least one retained learner-activity timestamp in the period, once per course even when they have several activities or the course appears in multiple learning paths. **Longest inactive** uses the latest retained learner activity across all dates for the matching authorized learner population, independent of the popularity period. Bars show full elapsed 24-hour days as of report generation. Courses with no recorded activity are listed first with a separate “No recorded learner activity” label, never a fabricated number of inactive days. Ties use course title and ID for stable rankings.

Recorded activity means the retained last course opening, course completion, lesson completions and submitted quizzes, including previous learning cycles. Content edits, enrollment dates and generic database update timestamps do not count. There is no complete historical log of course openings: older openings are overwritten, and deleted learning data cannot be reconstructed, so historical-period popularity may be understated. These are recorded-activity indicators, not a content freshness audit or an exact historical visitor analytics product.

Published, non-archived courses with enrollments but no activity remain eligible at zero popularity. Courses without enrollments are included only in an unfiltered organisation/course catalog and only when existing reporting permissions permit visibility. A selected group, learner, path or learning condition requires a matching enrollment; it never adds unrelated catalog courses. Draft, archived and foreign-tenant courses are excluded. For a path view, matching path rows supply their authorized linked course enrollments, consistent with the existing path report. Inactivity is scoped rather than disclosing activity by learners the viewer cannot report on. No course is automatically archived or modified.

Reports use current group membership and current enrollments of existing, non-deleted learners/content. Enrollment-date and completion-date conditions filter current records; they do not reconstruct historical learning or membership. A path selection includes courses linked to a learner's enrollment in that path, using shared course progress where a course belongs to multiple paths.

Organisation-wide reporting users manage shared configurations. Group managers can manage personal configurations and use shared configurations, but an inaccessible reference must be adapted before running the report. Saved configurations reopen current data rather than preserving a snapshot.

## Key Technical Context

- The `/reports` page provides the four views. The report API also retains the existing summary spreadsheet endpoint for compatibility.
- Existing reporting permissions distinguish broad reporting from managed-group results. Tenant isolation and server-side access checks remain authoritative; filters and saved configurations cannot grant additional access.
- Initial acceptance volume is 2,000 learners and 200,000 course enrollments, with ordinary report queries targeting under three seconds. The growth target is 10,000 learners and 1 million enrollments; it is not yet a measured capacity claim. Tables are paginated; large exports run in the background with visible status.
- Database indexes are a specific requirement: select tenant-aware indexes for actual predicates, joins, and ordering, validate query plans at representative volume, and generate migrations with existing tooling.
- Reports measure current learning state: current enrollments, current group membership, and existing learners and content. Date conditions narrow those current records, so a report for an earlier period can change later and is not a historical snapshot. Exports use a consistent snapshot at generation start, expire after 24 hours, and require current access at download. Course authors retain their owned-course reporting boundary; managed-group access is additive.

## Test Evidence

Backend integration tests exercise real database queries across all four views, group scoping and overlapping membership, nested OR rules, same-enrollment matching, timezone date boundaries, invalid filters, report access, and saved-configuration ownership. Export integration tests verify all matching rows despite pagination, rendered spreadsheet contents, access narrowing before download, and expiry cleanup. Focused tests cover filter validation, configuration/export lifecycle, and PDF/spreadsheet rendering.

Frontend utility tests cover compatible view changes, reset behaviour, and condition counting. A populated browser test passes in Chromium and Firefox with report endpoints mocked: all view subjects, nested OR filters, dates/scores, saved configurations, export completion/download, and reset clearing the subject, groups and conditions. Backend tests separately exercise real queries and rendering.

Course activity HTTP/database tests use the tenant-aware, NOBYPASSRLS application connection and real persisted fixtures. They cover timezone/DST boundaries, distinct learners despite repeated signals and overlapping paths, pagination independence, zero/no-enrollment courses, all-time inactivity independent of popularity dates, selected learner/course/score filters, managed-group and owned-course boundaries, foreign tenants, drafts and archived courses. Component/page tests exercise date selection, request wiring, distinct activity metrics and no-activity labels. All seven UI locales define the metric and data-limit explanations.

Not yet covered: the 10,000-learner growth target, concurrent report load, and memory use of very large exports have not been measured. The new historical activity aggregation has not been capacity-benchmarked.
