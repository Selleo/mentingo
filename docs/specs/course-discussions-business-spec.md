# Course Discussions Business Spec

## Business Overview

Course Discussions gives enrolled learners a course-level conversation space. Learners can ask questions, reply to classmates, react to messages, mention other enrolled learners, and remove their own messages when allowed.

For HR and L&D teams, discussions add peer learning and course-specific collaboration directly inside the learning experience, avoiding a separate chat tool for every course.

## Who Uses It

- Enrolled learners asking questions and sharing reflections inside a course.
- Trainers and course managers monitoring or moderating course conversation.
- Administrators enabling or disabling course discussions for the tenant.
- Mentioned learners who need to respond to a specific discussion item.

## Feature Functions

- Show or hide the Discussion tab based on the tenant-level course discussions setting.
- Show an empty discussion state when a course has no messages.
- Create top-level discussion threads.
- Reply to existing discussion threads.
- React to messages and toggle reactions off again.
- Mention other enrolled course users from a mention picker.
- Show online presence for course discussion participants.
- Soft-delete messages and preserve deleted placeholders when replies remain.
- Broadcast new messages, replies, reactions, deletions, mentions, and presence updates in realtime.
- Notify the thread author and earlier repliers when someone replies; the notification opens that thread.
- Follow the discussion from the organization-wide forum, which shows it as one entry per enrolled course when the forum is enabled.

## End-User Value

Learners can collaborate around the course while the context is fresh. Threads keep course-specific questions near the material, replies support peer assistance, and mentions help direct attention to the right participant.

Administrators and managers retain control through tenant-level enablement, enrollment checks, permissions, and delete/moderation paths.

## How It Works

When course discussions are enabled, enrolled learners with discussion access see a Chat tab alongside the table of contents on the course page. Opening it loads paginated top-level messages and enrolled course users, then joins a course-specific realtime room for live updates.

Learners can post a thread or open a thread to reply. Mentions are limited to users enrolled in the same course. Reactions and deletions are broadcast to other open course discussion sessions so the page updates without a full reload.

When someone replies in a thread, its author and the learners who replied earlier get a notification in the application, unless they wrote the reply themselves, were mentioned in it, or are no longer enrolled. Opening the notification shows the course's Discussion tab on the page that holds the thread, with the thread open. The same link format, `?tab=Discussion`, is used by the mention e-mail and now opens the tab as well.

Discussion APIs are feature-gated and permission-gated. Reading, posting, reacting, deleting, and joining realtime rooms all check course access so users cannot participate in discussions for courses they are not allowed to access.

When the forum is enabled, it lists each enrolled course that has discussion messages, with the number of messages and the latest activity. Selecting a course opens its discussion inside the forum as a single topic, where enrolled users can read, post, reply and react under the same rules. Both views show the same messages.

## Key Technical Context

- Frontend UI lives under `apps/web/app/modules/Courses/CourseView/CourseChat` and is surfaced from the table-of-contents tabs.
- API, gateway, presence, and event handling live under `apps/api/src/course-chat`.
- The feature is gated by `FEATURES.COURSE_DISCUSSIONS`.
- Core permissions include `PERMISSIONS.COURSE_DISCUSSION_READ`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_REACT`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN`, and `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE`.
- Realtime behavior uses Socket.IO rooms plus course-chat events for messages, reactions, deletions, mentions, and presence.
- Mention email handling uses the existing event/outbox pattern.
- Reply notifications are handled in `apps/api/src/discussion-notifications`; see `docs/specs/announcements-notifications-business-spec.md`. The link is built by `getCourseDiscussionThreadPath` from `@repo/shared`, and `GET /course-chat/:courseId/messages?aroundMessageId=` returns the page that holds a thread.
- Course threads and forum topics share the discussion tables with a `course` or `general` scope; course discussion endpoints ignore general forum posts and forum topic endpoints ignore course threads. See `docs/specs/forum-business-spec.md`.

## Test Evidence

- Web E2E coverage verifies feature visibility, the empty state, thread and reply creation, reactions, deletion, mentions, presence, pagination, and realtime updates between enrolled learners.
- Backend E2E coverage verifies the feature gate, authentication, permissions, enrollment isolation, moderation rules, message and reply pagination, validation, and deleted-thread behavior.
- Mention email delivery remains covered by the dedicated Course Chat mention handler test.
- Reply notifications are covered by the discussion reply E2E tests; web unit tests cover opening the Discussion tab and the linked thread from the URL.
