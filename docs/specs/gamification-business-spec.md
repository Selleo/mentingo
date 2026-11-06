# Gamification Business Spec

## Business Overview

Gamification rewards learners for the learning habits HR and L&D teams want to build: logging in regularly, completing lessons and courses, and doing well in quizzes. Each habit is tracked by an achievement. When a learner reaches an achievement level, Mentingo grants experience points (XP), and accumulated XP moves the learner up through levels.

Learners see their own level, XP and achievements on their profile and in a dashboard widget, and get a toast when they unlock something new. For now, each learner's gamification progress is visible only to that learner.

Every organization gets gamification with a ready-made set of achievements, translated into all supported languages. When a new default achievement is added, learners receive credit for past activity recorded in the platform's event history.

The gamification UI is hidden by default. An administrator switches it on per organization on the Gamification admin page. Progress is calculated in the background either way, so learners see everything they have already earned as soon as it is switched on.

Administrators can also create their own achievements without code changes. They pick the activity to reward, how it is counted, optional course or quiz score filters, levels with XP rewards and badges, an icon, and visibility. Custom achievements use the same engine as the default ones.

## Who Uses It

- Learners complete lessons, courses and quizzes as usual. They watch their level grow, track progress toward the next achievement level, and get notified when they unlock a reward.
- HR and L&D teams get a motivation layer that works in every organization from day one, with nothing to configure.
- Administrators switch gamification on, disable default achievements that do not fit, and add custom achievements for the behaviors their organization wants to reward.

## Feature Functions

- Reward learners with XP when they reach an achievement level.
- Move learners up levels as their lifetime XP grows, and show the XP needed for the next level.
- Track progress toward multi-level achievements, such as completing 5, 25 and 50 lessons, or logging in 3, 7 and 14 days in a row. Each achievement has at most three levels.
- Recognize quiz excellence, such as passing a quiz with a 100% score.
- Show the user's own achievements, level and recent rewards on their profile and in a "Level and achievements" dashboard widget.
- Notify the learner with a toast when a new achievement level is unlocked.
- Credit past activity when achievements are introduced.
- Keep hidden achievements secret until earned, and let only learners, content creators and trainers earn them.
- Let administrators switch gamification on or off for the organization.
- Let administrators review default and custom achievements in one list, enable or disable any of them, and create or edit custom ones.
- Support four ways of counting for custom achievements: first time, count, daily streak, and the most activity within a rolling time window (for example, 5 lessons within 7 days).
- Offer only the filters the chosen activity can be checked against: a course filter for lessons, courses and quizzes, and a minimum score filter for quizzes.
- Show a badge for every achievement level. Level 1 shows the tier 1 badge, level 2 the tier 2 badge and level 3 the tier 3 badge, unless an administrator uploads an image for that level. Tier badges take the colour closest to the organization's theme colour. Each achievement has an icon, picked by the administrator from a searchable list of 76 icons, that is drawn on its tier badges so achievements can be told apart; uploaded images are shown as they are. The form shows a preview of every level's badge. Learners see the badge of the highest level they have earned; before any level is earned, the level 1 badge is shown greyed out. If an uploaded image cannot be loaded, the tier badge is shown instead.

## End-User Value

- Encourages steady learning habits through login streaks and completion milestones.
- Gives learners immediate, visible feedback that their effort counts.
- Works out of the box in every organization and in every supported language.
- Treats learners fairly: earlier activity is credited, and rewards are never taken away.

## How It Works

Learners use Mentingo as usual. When they log in, complete a lesson, finish a course or complete a quiz, Mentingo re-checks their achievements in the background a moment later. Any newly reached achievement level grants its XP. A learner's level rises with lifetime XP: level 2 at 100 XP, level 3 at 400 XP, level 4 at 900 XP, and so on.

Counting is fair and predictable:

- Repeating the same lesson counts once.
- A login streak counts consecutive calendar days (UTC), and the learner's longest streak is what counts.
- A time-window achievement counts the most distinct activities inside any rolling window of the configured number of days.
- Quiz achievements can require a minimum score.
- Activity done by staff while in support mode on a learner's behalf never counts.

Rewards only ever accumulate. A level that has been earned stays earned, and replaying the same activity never grants XP twice. A disabled achievement stops granting new levels, but levels already earned are kept and still shown on the profile.

Administrators manage achievements on the Gamification page under Manage. Default achievements open in a read-only view and can only be enabled or disabled, because their definitions ship with the platform. Custom achievements can be fully edited: name and description per language, activity, way of counting, filters, levels with their badges, visibility and status. The rest of the definition belongs to the base language: in another language only the name and description can be translated, empty translations are flagged, and learners see the base-language text until they are filled in. An achievement has at most three levels, each must require more than the one before it, and a first-time achievement has exactly one level. Levels that someone has already earned cannot be removed, so editing never takes rewards away. Whenever an enabled achievement is created, edited or re-enabled, past activity is recalculated in the background, so learners get credit for what they have already done. Editing first clears the stored progress for that achievement, so progress shown to learners always reflects the current rules.

Hidden achievements do not appear on profiles until they are earned. Learners, content creators and trainers can earn them. Administrators and group managers cannot.

The user's own profile shows their level and XP, then each achievement with its description, the levels earned and the date of the latest one, plus a progress bar toward the next level. The dashboard widget shows the current user's level and their latest rewards. While the learner uses the app, it checks for new rewards about every 30 seconds and shows a toast for each new one.

## Key Technical Context

- Achievements are measured from the platform's durable domain-event history (login, lesson completed, course finished, quiz completed). Live updates and backfills use the same calculation, so it is safe to re-run.
- Default achievements are added for every organization at platform startup and when a new organization is created. When a new default is added, the organization's past activity is recalculated. Existing default achievements are not overwritten, except that their icon is refreshed, so an icon change reaches every organization.
- There are three permissions. "View levels, XP and achievements" is granted to every role, and the API only returns the requesting user's own profile. "Earn hidden achievements" is granted to learners, content creators and trainers. "Configure achievements and gamification settings" is granted to administrators and covers the admin page, the achievement API and the on/off toggle. All data is isolated per organization.
- Achievement titles and descriptions follow the user's selected language and fall back to the achievement's base language.
- XP is tracked as lifetime XP, which drives levels, and as spendable XP, kept for a future rewards store.
- A per-organization setting (`gamificationEnabled`, off by default) shows or hides the profile section, the dashboard widget and the reward toasts. Administrators toggle it on the Gamification admin page. Reward calculation and the gamification API do not depend on it.
- The API rejects filters the chosen activity cannot be checked against, courses outside the organization, badge images that were not uploaded to the organization's badge storage, windows longer than 365 days, XP rewards above 100,000 and names or descriptions longer than 500 characters. The admin form checks the same limits, and only for the fields it shows.
- Creating, editing or re-enabling an enabled achievement re-runs the organization-wide recalculation, which takes longer in large organizations.
- Main sources: `apps/api/src/gamification/`, `apps/web/app/modules/Gamification/`, `apps/web/app/modules/Admin/Gamification/` and `packages/shared/src/constants/gamification.ts`.
- Not included yet: achievements for chat, likes and mentions; scores from reviewer-graded quizzes; deleting custom achievements (they can be disabled); a course picker beyond the first 100 courses; showing achievements on other users' profiles (#2131 asks for it, deferred for now).

## Test Evidence

- The backend E2E spec (`apps/api/src/gamification/__tests__/gamification.e2e-spec.ts`) covers:
  - Events are built from the real event classes, so the tests break if a payload shape drifts.
  - Default achievements are seeded once per organization, and an existing default gets its icon refreshed.
  - Repeated lessons count once, rewards are idempotent, and concurrent evaluations grant once.
  - Support-mode lessons and quizzes are ignored while the learner's own activity counts.
  - Login streaks use the longest run of consecutive days, and level-ups happen.
  - Course completion, the quiz score filter and the course filter apply.
  - Administrators cannot earn hidden achievements; trainers and content creators can.
  - Disabled achievements stop granting but keep earned rewards; rewards are never revoked.
  - Tenant recalculation backfills active users and skips archived ones.
  - The user's own profile shows progress and recent rewards while unearned hidden achievements stay hidden; another user's profile is rejected.
- The achievement admin E2E spec (`apps/api/src/gamification/__tests__/achievement-admin.e2e-spec.ts`) covers:
  - Only administrators can list achievements, and the list includes the defaults with their badge and per-level earned counts.
  - A custom quiz achievement with a score filter is granted by the engine.
  - Time-window achievements measure the best rolling window.
  - Invalid definitions are rejected: unsupported filters, a missing base-language name, invalid first-time levels, more than three levels, thresholds that do not ascend, a time window without its length, a window length on the wrong type, unknown courses, foreign badge images and tenant files that are not badges.
  - An uploaded level badge is accepted and its URL is returned to the admin form and the learner profile.
  - Students are rejected on every admin achievement endpoint.
  - Making an achievement stricter re-measures learners' progress.
  - Default achievements are read-only but can be disabled, which stops new rewards.
  - Earned levels cannot be removed, levels can be added, and the profile shows each level's badge.
  - Only administrators can switch gamification on.
- The tenant isolation E2E spec (`apps/api/src/gamification/__tests__/achievement-admin-tenants.e2e-spec.ts`) runs with row-level security enforced and checks that another organization's administrator cannot list, read, edit or toggle an achievement.
- Unit specs cover the outbox reactions for all four event types (including support mode), and the validity of the predefined achievement definitions.
- Web unit tests cover the level and achievement progress calculations, the reward toasts, the achievement form (filters per activity, window length, first-time levels, validation of visible fields only, and the API limits), and the badge assets (a tier badge for every colour and level, and the closest theme colour). The Playwright dashboard layout spec covers the widget's place in the learner's default dashboard.
- No Playwright spec yet covers the profile section, the reward toast or the achievement admin page end to end.
