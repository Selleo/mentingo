# Gamification Business Spec

## Business Overview

Gamification rewards learners for the learning habits HR and L&D teams want to build: logging in regularly, completing lessons and courses, and doing well in quizzes. Each habit is tracked by an achievement. When a learner reaches an achievement level, Mentingo grants experience points (XP), and accumulated XP moves the learner up through levels.

Learners see their own level, XP and achievements on their profile and in a dashboard widget, and get a toast when they unlock something new. For now, each learner's gamification progress is visible only to that learner.

Every organization gets gamification with a ready-made set of achievements, translated into all supported languages. When a new default achievement is added, learners receive credit for past activity recorded in the platform's event history.

For now the gamification UI is hidden by default and is switched on per organization by the Mentingo team; there is no admin toggle yet. Progress is calculated in the background either way, so learners see everything they have already earned as soon as it is switched on.

## Who Uses It

- Learners complete lessons, courses and quizzes as usual. They watch their level grow, track progress toward the next achievement level, and get notified when they unlock a reward.
- HR and L&D teams get a motivation layer that works in every organization from day one, with nothing to configure.

## Feature Functions

- Reward learners with XP when they reach an achievement level.
- Move learners up levels as their lifetime XP grows, and show the XP needed for the next level.
- Track progress toward multi-level achievements, such as completing 5, 25, 50 and 100 lessons, or logging in 3, 7, 14 and 30 days in a row.
- Recognize quiz excellence, such as passing a quiz with a 100% score.
- Show the user's own achievements, level and recent rewards on their profile and in a "Level and achievements" dashboard widget.
- Notify the learner with a toast when a new achievement level is unlocked.
- Credit past activity when achievements are introduced.
- Keep hidden achievements secret until earned, and let only learners, content creators and trainers earn them.

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
- Quiz achievements can require a minimum score.
- Activity done by staff while in support mode on a learner's behalf never counts.

Rewards only ever accumulate. A level that has been earned stays earned, and replaying the same activity never grants XP twice. A disabled achievement stops granting new levels, but levels already earned are kept and still shown on the profile. Administrators will be able to disable achievements once achievement management (#1720) ships.

Hidden achievements do not appear on profiles until they are earned. Learners, content creators and trainers can earn them. Administrators and group managers cannot.

The user's own profile shows their level and XP, then each achievement with its description, the levels earned and the date of the latest one, plus a progress bar toward the next level. The dashboard widget shows the current user's level and their latest rewards. While the learner uses the app, it checks for new rewards about every 30 seconds and shows a toast for each new one.

## Key Technical Context

- Achievements are measured from the platform's durable domain-event history (login, lesson completed, course finished, quiz completed). Live updates and backfills use the same calculation, so it is safe to re-run.
- Default achievements are added for every organization at platform startup and when a new organization is created. When a new default is added, the organization's past activity is recalculated.
- There are two permissions. "View levels, XP and achievements" is granted to every role, and the API only returns the requesting user's own profile. "Earn hidden achievements" is granted to learners, content creators and trainers. All data is isolated per organization.
- Achievement titles and descriptions follow the user's selected language and fall back to the achievement's base language.
- XP is tracked as lifetime XP, which drives levels, and as spendable XP, kept for a future rewards store.
- A per-organization setting (`gamificationEnabled`, off by default) shows or hides the profile section, the dashboard widget and the reward toasts. It has no UI or API toggle yet and is set directly in the organization's global settings. Reward calculation and the gamification API do not depend on it.
- Main sources: `apps/api/src/gamification/`, `apps/web/app/modules/Gamification/` and `packages/shared/src/constants/gamification.ts`.
- Not included yet: achievements for chat, likes and mentions; scores from reviewer-graded quizzes; admin management of achievements (planned in #1720, in a separate gamification settings tab); showing achievements on other users' profiles (#2131 asks for it, deferred for now).

## Test Evidence

- The backend E2E spec (`apps/api/src/gamification/__tests__/gamification.e2e-spec.ts`) covers:
  - Events are built from the real event classes, so the tests break if a payload shape drifts.
  - Default achievements are seeded once per organization.
  - Repeated lessons count once, rewards are idempotent, and concurrent evaluations grant once.
  - Support-mode lessons and quizzes are ignored while the learner's own activity counts.
  - Login streaks use the longest run of consecutive days, and level-ups happen.
  - Course completion, the quiz score filter and the course filter apply.
  - Administrators cannot earn hidden achievements; trainers and content creators can.
  - Disabled achievements stop granting but keep earned rewards; rewards are never revoked.
  - Tenant recalculation backfills active users and skips archived ones.
  - The user's own profile shows progress and recent rewards while unearned hidden achievements stay hidden; another user's profile is rejected.
- Unit specs cover the outbox reactions for all four event types (including support mode), and the validity of the predefined achievement definitions.
- Web unit tests cover the level and achievement progress calculations and the reward toasts. The Playwright dashboard layout spec covers the widget's place in the learner's default dashboard.
- No Playwright spec yet covers the profile section or the reward toast end to end.
