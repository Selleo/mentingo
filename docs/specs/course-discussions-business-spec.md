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

## End-User Value

Learners can collaborate around the course while the context is fresh. Threads keep course-specific questions near the material, replies support peer assistance, and mentions help direct attention to the right participant.

Administrators and managers retain control through tenant-level enablement, enrollment checks, permissions, and delete/moderation paths.

## How It Works

When course discussions are enabled, enrolled learners see a Discussion tab on the course page. The tab loads paginated top-level messages and enrolled course users, then joins a course-specific realtime room for live updates.

Learners can post a thread or open a thread to reply. Mentions are limited to users enrolled in the same course. Reactions and deletions are broadcast to other open course discussion sessions so the page updates without a full reload.

Discussion APIs are feature-gated and permission-gated. Reading, posting, reacting, deleting, and joining realtime rooms all check course access so users cannot participate in discussions for courses they are not allowed to access.

## Key Technical Context

- Frontend UI lives under `apps/web/app/modules/Courses/CourseView/CourseChat`.
- API, gateway, presence, and event handling live under `apps/api/src/course-chat`.
- The feature is gated by `FEATURES.COURSE_DISCUSSIONS`.
- Core permissions include `PERMISSIONS.COURSE_DISCUSSION_READ`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_REACT`, `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN`, and `PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE`.
- Realtime behavior uses Socket.IO rooms plus course-chat events for messages, reactions, deletions, mentions, and presence.
- Mention email handling uses the existing event/outbox pattern.

## Test Evidence

- Web E2E coverage verifies the Discussion tab is hidden when globally disabled, the empty state appears when enabled, learners can create threads, reply, react and toggle reactions, delete a thread with replies, and select mentioned enrolled users.
- Backend behavior is evidenced by the Course Chat controller, service, gateway, presence store/service, repository, and mention email handler.
- I did not find a dedicated Course Chat backend E2E spec in the current API test tree.
