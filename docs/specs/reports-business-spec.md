# Reports

Status: first-release implementation; browser and database integration checks pass. Capacity validation is recorded below.

## Business Overview

Reports help HR and L&D answer “How is the organisation progressing?” Users review organisation learning, development-path progress, course performance, and individual learner progress, following the four views in `mentingo-reports-demo.html`.

Users select an organisation or group population, combine conditions, and review metrics and results calculated from the same filtered learning. They can save personal or organisation-wide configurations and export complete filtered results as PDF or spreadsheets.

## Who Uses It

- Users with organisation-wide reporting access compare learning progress across groups and manage shared configurations for their organisation.
- Group managers review learning for members of their managed groups, save personal configurations, and reuse shared configurations within their permitted population.

## Feature Functions

- Review organisation, development-path, course, and learner progress through four report views.
- Scope analysis to selected groups, including their members' individually assigned learning and learning assigned through other groups.
- Combine applicable conditions using AND/OR groups with one level of nesting, including status, content, learner, progress, dates, quiz results, certificates, and last activity.
- Recalculate headline metrics and results from all active conditions, with clear scope and condition labels.
- Save personal and organisation-wide configurations for reuse with current data and current access rights.
- Preserve compatible conditions when changing views, explain incompatible conditions, and reset all filters with one button while retaining the report subject.
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

Frontend utility tests cover compatible view changes, reset behaviour, and condition counting. A populated browser test passes in Chromium and Firefox with report endpoints mocked: all view subjects, nested OR filters, dates/scores, saved configurations, export completion/download, and reset retaining the subject. Backend tests separately exercise real queries and rendering.

Not yet covered: the 10,000-learner growth target, concurrent report load, and memory use of very large exports have not been measured.
